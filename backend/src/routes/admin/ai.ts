/**
 * Admin → AI. Everything here applies at runtime (the policy is cached 30 s).
 *
 *   GET    /api/admin/ai                     → the platform map + policy
 *   PUT    /api/admin/ai/settings            → kill switch, pause message, user map,
 *                                              lanes, budget, free-tier rule, MCP limits
 *   PUT    /api/admin/ai/features/:feature   → per-feature rule (on/off, allowed lanes,
 *                                              forced lane, default lane, included limit)
 *   PUT    /api/admin/ai/routes/:feature     {keyId, model?} → where Included runs
 *                                              (":feature" may be "default")
 *   DELETE /api/admin/ai/routes/:feature     → the feature borrows the default again
 *   POST   /api/admin/ai/keys                → add a platform key (tested on save)
 *   PATCH  /api/admin/ai/keys/:id            → rename / rotate
 *   POST   /api/admin/ai/keys/:id/check
 *   GET    /api/admin/ai/keys/:id/models
 *   DELETE /api/admin/ai/keys/:id
 *   GET    /api/admin/ai/usage?period=YYYY-MM → the spend lens
 *   GET    /api/admin/ai/users/:id           → one person's AI: override, month, keys
 *   PUT    /api/admin/ai/users/:id           → override: suspend, allowance, forced lane, note
 *
 * Every change is audit-logged with its before and after.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { getUser } from "../../middleware/auth.js";
import { AiUsage, currentPeriod, periodResetsAt } from "../../models/AiUsage.js";
import { AiKey } from "../../models/AiKey.js";
import { McpToken } from "../../models/McpToken.js";
import { User } from "../../models/User.js";
import { AppError, NotFoundError } from "../../errors/AppError.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { AI_LANES, AI_PROVIDER_IDS } from "../../services/ai/providerIds.js";
import { getAiSettings, updateAiSettings, updateFeaturePolicy } from "../../services/ai/settings.js";
import { addKey, checkKey, deleteKey, modelsForKey, updateKey } from "../../services/ai/keys.js";
import { ensureDefaultRoute } from "../../services/ai/routing.js";
import { includedSpend, userUsage, featureOf } from "../../services/ai/ledger.js";
import { adminAiMap, setPlatformRoute } from "../../services/ai/map.js";
import { isAiFeatureId } from "../../services/ai/registry.js";

const router = Router();
const PLATFORM = { owner: "platform" as const };

const badRequest = (res: Response, err: z.ZodError) => res.status(400).json({ error: err.flatten().fieldErrors });

function audit(req: Request, action: "settings_change" | "create" | "update" | "delete", resourceType: "setting" | "ai_provider" | "user", extra: { resourceId?: string; oldValue?: unknown; newValue?: unknown; metadata?: unknown }) {
  const admin = getUser(req);
  void logAudit({ userId: admin._id, action, resourceType, ...extra, ...getClientInfo(req) });
}

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await adminAiMap());
  } catch (err) { next(err); }
});

/* ---------------- policy ---------------- */

const settingsSchema = z.object({
  aiEnabled: z.boolean().optional(),
  pauseMessage: z.string().max(280).optional(),
  userMapEnabled: z.boolean().optional(),
  lanes: z.object({ included: z.boolean().optional(), byok: z.boolean().optional(), assistant: z.boolean().optional() }).optional(),
  budget: z.object({
    monthlyCapUsd: z.number().min(0).max(100_000).optional(),
    perUserAllowanceUsd: z.number().min(0).max(1_000).optional(),
    alertAtPct: z.array(z.number().int().min(1).max(100)).max(6).optional(),
  }).optional(),
  freeTierKeysForEmail: z.boolean().optional(),
  mcp: z.object({
    enabled: z.boolean().optional(),
    callsPerHour: z.number().int().min(1).max(100_000).optional(),
    writesPerHour: z.number().int().min(0).max(100_000).optional(),
    writeToolsEnabled: z.boolean().optional(),
  }).optional(),
});

router.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const before = await getAiSettings();
    const after = await updateAiSettings(parsed.data, getUser(req)._id);
    audit(req, "settings_change", "setting", {
      metadata: { area: "ai" },
      oldValue: { aiEnabled: before.aiEnabled, userMapEnabled: before.userMapEnabled, lanes: before.lanes, budget: before.budget, mcp: before.mcp },
      newValue: parsed.data,
    });
    res.json(after);
  } catch (err) { next(err); }
});

const featureRuleSchema = z.object({
  enabled: z.boolean().optional(),
  allowedLanes: z.array(z.enum(AI_LANES)).min(1).optional(),
  forcedLane: z.enum(AI_LANES).nullable().optional(),
  defaultLane: z.enum(AI_LANES).optional(),
  includedMonthlyLimit: z.number().int().min(0).max(10_000).optional(),
});

router.put("/features/:feature", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature = String(req.params.feature);
    if (!isAiFeatureId(feature)) throw new NotFoundError("AI feature");
    const parsed = featureRuleSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const before = (await getAiSettings()).features[feature];
    const after = await updateFeaturePolicy(feature, parsed.data, getUser(req)._id);
    audit(req, "settings_change", "setting", { metadata: { area: "ai", feature }, oldValue: before, newValue: after.features[feature] });
    res.json(after);
  } catch (err) { next(err); }
});

/* ---------------- platform routes + keys ---------------- */

const platformRouteSchema = z.object({ keyId: z.string().nullable(), model: z.string().max(160).nullable().optional() });

router.put("/routes/:feature", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = platformRouteSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const feature = String(req.params.feature);
    await setPlatformRoute(feature, parsed.data, getUser(req)._id);
    audit(req, "update", "ai_provider", { metadata: { route: feature }, newValue: parsed.data });
    res.json(await adminAiMap());
  } catch (err) { next(err); }
});

router.delete("/routes/:feature", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feature = String(req.params.feature);
    await setPlatformRoute(feature, { keyId: null }, getUser(req)._id);
    audit(req, "delete", "ai_provider", { metadata: { route: feature } });
    res.json(await adminAiMap());
  } catch (err) { next(err); }
});

const addKeySchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  name: z.string().max(60).optional().default(""),
  secret: z.string().min(1).max(4096),
  freeTier: z.boolean().optional(),
});

router.post("/keys", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addKeySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const admin = getUser(req);
    const { key, note } = await addKey(PLATFORM, parsed.data, admin._id);
    await ensureDefaultRoute("platform", null, new mongoose.Types.ObjectId(key.id));
    audit(req, "create", "ai_provider", { resourceId: key.id, newValue: { provider: key.provider, name: key.name, last4: key.last4 } });
    res.status(201).json({ key, note, map: await adminAiMap() });
  } catch (err) { next(err); }
});

router.patch("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ name: z.string().max(60).optional(), secret: z.string().min(1).max(4096).optional(), freeTier: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const result = await updateKey(PLATFORM, String(req.params.id), parsed.data);
    audit(req, "update", "ai_provider", { resourceId: result.key.id, newValue: { name: parsed.data.name, rotated: Boolean(parsed.data.secret) } });
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/keys/:id/check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ key: await checkKey(PLATFORM, String(req.params.id)) });
  } catch (err) { next(err); }
});

router.get("/keys/:id/models", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ models: await modelsForKey(PLATFORM, String(req.params.id)) });
  } catch (err) { next(err); }
});

router.delete("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteKey(PLATFORM, String(req.params.id));
    audit(req, "delete", "ai_provider", { resourceId: String(req.params.id), metadata: result });
    res.json({ ...result, map: await adminAiMap() });
  } catch (err) { next(err); }
});

/* ---------------- the spend lens ---------------- */

router.get("/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = typeof req.query.period === "string" ? req.query.period : "";
    const period = /^\d{4}-\d{2}$/.test(raw) ? raw : currentPeriod();
    const policy = await getAiSettings();
    const committed = { $cond: [{ $eq: ["$status", "reserved"] }, "$reservedUsd", "$estCostUsd"] };

    const [spent, rows, byUser, daily] = await Promise.all([
      includedSpend(period),
      AiUsage.aggregate<{ _id: { feature: string | null; opType: string | null; lane: string | null; provider: string; model: string; status: string; ok: boolean | null; errorCode: string | null; byok: boolean | null }; calls: number; cost: number; tokens: number }>([
        { $match: { period } },
        {
          $group: {
            _id: { feature: "$feature", opType: "$opType", lane: "$lane", provider: "$provider", model: "$model", status: "$status", ok: "$ok", errorCode: "$errorCode", byok: "$byok" },
            calls: { $sum: 1 },
            cost: { $sum: committed },
            tokens: { $sum: { $add: [{ $ifNull: ["$tokensIn", 0] }, { $ifNull: ["$tokensOut", 0] }] } },
          },
        },
      ]),
      AiUsage.aggregate<{ _id: mongoose.Types.ObjectId; cost: number; calls: number }>([
        { $match: { period, lane: "included", status: { $in: ["reserved", "settled"] } } },
        { $group: { _id: "$userId", cost: { $sum: committed }, calls: { $sum: 1 } } },
        { $sort: { cost: -1 } },
        { $limit: 10 },
      ]),
      AiUsage.aggregate<{ _id: string; cost: number; calls: number }>([
        { $match: { period, status: { $in: ["reserved", "settled"] } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
            cost: { $sum: { $cond: [{ $eq: ["$lane", "included"] }, committed, 0] } },
            calls: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    type FeatureRow = { feature: string; calls: number; failures: number; refusals: number; cached: number; costUsd: number; tokens: number; lanes: Record<string, number> };
    const features = new Map<string, FeatureRow>();
    const providers = new Map<string, { provider: string; model: string; calls: number; failures: number; costUsd: number }>();
    const failures = new Map<string, number>();
    const refusals = new Map<string, number>();
    for (const r of rows) {
      const f = featureOf(r._id as { feature?: string; opType?: string });
      const lane = r._id.lane ?? (r._id.byok ? "byok" : "included");
      const fr = features.get(f) ?? { feature: f, calls: 0, failures: 0, refusals: 0, cached: 0, costUsd: 0, tokens: 0, lanes: {} };
      if (r._id.status === "refused") {
        fr.refusals += r.calls;
        refusals.set(r._id.errorCode ?? "unknown", (refusals.get(r._id.errorCode ?? "unknown") ?? 0) + r.calls);
      } else {
        fr.calls += r.calls;
        fr.tokens += r.tokens;
        if (lane === "included") fr.costUsd += r.cost;
        fr.lanes[lane] = (fr.lanes[lane] ?? 0) + r.calls;
        if (r._id.ok === false) {
          fr.failures += r.calls;
          failures.set(r._id.errorCode ?? "unknown", (failures.get(r._id.errorCode ?? "unknown") ?? 0) + r.calls);
        }
        if (r._id.provider && r._id.provider !== "none") {
          const k = `${r._id.provider}|${r._id.model}`;
          const p = providers.get(k) ?? { provider: r._id.provider, model: r._id.model, calls: 0, failures: 0, costUsd: 0 };
          p.calls += r.calls;
          if (r._id.ok === false) p.failures += r.calls;
          if (lane === "included") p.costUsd += r.cost;
          providers.set(k, p);
        }
      }
      features.set(f, fr);
    }
    const users = await User.find({ _id: { $in: byUser.map((u) => u._id) } }).select("name email").lean();
    const round = (n: number) => Math.round(n * 1e4) / 1e4;
    res.json({
      period,
      resetsAt: periodResetsAt().toISOString(),
      capUsd: policy.budget.monthlyCapUsd,
      perUserAllowanceUsd: policy.budget.perUserAllowanceUsd,
      includedSpentUsd: round(spent),
      features: [...features.values()].map((f) => ({ ...f, costUsd: round(f.costUsd) })).sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
      providers: [...providers.values()].map((p) => ({ ...p, costUsd: round(p.costUsd) })).sort((a, b) => b.calls - a.calls),
      failures: [...failures.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n),
      refusals: [...refusals.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n),
      topUsers: byUser.map((u) => {
        const who = users.find((x) => String(x._id) === String(u._id));
        return { userId: String(u._id), name: who?.name ?? "", email: who?.email ?? "(deleted)", costUsd: round(u.cost), calls: u.calls };
      }),
      daily: daily.map((d) => ({ day: d._id, costUsd: round(d.cost), calls: d.calls })),
    });
  } catch (err) { next(err); }
});

/* ---------------- one person ---------------- */

router.get("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new NotFoundError("User");
    const user = await User.findById(req.params.id).select("name email aiOverride").lean();
    if (!user) throw new NotFoundError("User");
    const policy = await getAiSettings();
    const [usage, keys, tokens] = await Promise.all([
      userUsage(user._id, policy, user.aiOverride?.allowanceUsd ?? null),
      AiKey.find({ owner: "user", userId: user._id }).select("provider name last4 lastError createdAt").lean(),
      McpToken.countDocuments({ userId: user._id, revokedAt: null }),
    ]);
    res.json({
      override: user.aiOverride ?? { suspended: false, allowanceUsd: null, forcedLane: null, note: "" },
      usage,
      keys: keys.map((k) => ({ provider: k.provider, name: k.name, last4: k.last4, healthy: !k.lastError, createdAt: k.createdAt })),
      assistantTokens: tokens,
    });
  } catch (err) { next(err); }
});

const overrideSchema = z.object({
  suspended: z.boolean().optional(),
  allowanceUsd: z.number().min(0).max(1_000).nullable().optional(),
  forcedLane: z.enum(AI_LANES).nullable().optional(),
  note: z.string().max(280).optional(),
});

router.put("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new NotFoundError("User");
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const user = await User.findById(req.params.id).select("aiOverride role");
    if (!user) throw new NotFoundError("User");
    if (user.role === "admin" && parsed.data.suspended) throw new AppError("Admins can't be suspended from AI.", 400);
    const before = user.aiOverride ? { ...(user.aiOverride as object) } : null;
    const next_ = {
      suspended: parsed.data.suspended ?? user.aiOverride?.suspended ?? false,
      allowanceUsd: parsed.data.allowanceUsd !== undefined ? parsed.data.allowanceUsd : user.aiOverride?.allowanceUsd ?? null,
      forcedLane: parsed.data.forcedLane !== undefined ? parsed.data.forcedLane : user.aiOverride?.forcedLane ?? null,
      note: parsed.data.note ?? user.aiOverride?.note ?? "",
    };
    await User.updateOne({ _id: user._id }, { $set: { aiOverride: next_ } });
    audit(req, "update", "user", { resourceId: String(user._id), metadata: { area: "ai_override" }, oldValue: before, newValue: next_ });
    res.json({ override: next_ });
  } catch (err) { next(err); }
});

export default router;
