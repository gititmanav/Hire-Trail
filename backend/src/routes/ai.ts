/**
 * AI platform routes — BYOK management, provider catalog, status, usage.
 *
 * Contract:
 *   GET    /api/ai/providers          → catalog [{id,label,models[],freeTier,getKeyUrl}]
 *   GET    /api/ai/keys               → [{id,provider,label,last4,isActive,createdAt}]
 *   POST   /api/ai/keys               {provider,key,label?}
 *   POST   /api/ai/keys/:id/activate  → activate (deactivates ALL other keys)
 *   DELETE /api/ai/keys/:id
 *   POST   /api/ai/keys/validate      {provider,key} → {ok,modelTested?}
 *   GET    /api/ai/status             → {hasActiveKey,mode}
 *   GET    /api/ai/usage              → byok {tokensIn,tokensOut,estCostUsd,period}
 *                                       | default {usedPct,used,limit,resetsAt}
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { AIProviderConfig, type IAIProviderConfig } from "../models/AIProviderConfig.js";
import { encrypt } from "../utils/encryption.js";
import { getAiStatus, gatewayEnabled } from "../services/ai/index.js";
import { getCatalog } from "../services/ai/catalog.js";
import { ensureGatewayModels } from "../services/ai/gatewayModels.js";
import { validateProviderKey } from "../services/ai/validateKey.js";
import { usageSummary } from "../services/ai/usage.js";
import { getAdminAiConfig } from "../services/ai/adminConfig.js";
import { NotFoundError } from "../errors/AppError.js";
import { byokValidateLimiter } from "../middleware/rateLimiter.js";

const router = Router();
router.use(ensureAuth);
// Demo user can read (to render the empty state) but never writes / pings providers.
router.post(/.*/, blockDemoUser);
router.put(/.*/, blockDemoUser);
router.delete(/.*/, blockDemoUser);

/** Public shape for a stored key — never includes the ciphertext. */
function keyView(k: Pick<IAIProviderConfig, "_id" | "provider" | "name" | "last4" | "isActive" | "createdAt">) {
  return {
    id: k._id.toString(),
    provider: k.provider,
    label: k.name || "",
    last4: k.last4 || "",
    isActive: k.isActive,
    createdAt: k.createdAt,
  };
}

/** Deactivate every active key for a user EXCEPT the given id (one-active-per-user). */
async function deactivateOthers(userId: unknown, exceptId?: unknown): Promise<void> {
  const filter: Record<string, unknown> = { userId, isActive: true };
  if (exceptId) filter._id = { $ne: exceptId };
  await AIProviderConfig.updateMany(filter, { $set: { isActive: false } });
}

/* -------------------- catalog + status + usage -------------------- */

router.get("/providers", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureGatewayModels(); // so the catalog includes live/dynamic providers
    res.json({
      gatewayConfigured: gatewayEnabled(),
      providers: getCatalog().map((p) => ({
        id: p.id,
        label: p.label,
        models: p.models.map((m) => ({ id: m.id, label: m.label, capability: m.capability })),
        freeTier: p.freeTier,
        getKeyUrl: p.getKeyUrl,
        keyKind: p.keyKind,
        gatewayOnly: p.gatewayOnly ?? false,
        credentialFormat: p.credentialFormat ?? "apiKey",
        credentialFields: p.credentialFields ?? null,
      })),
    });
  } catch (err) { next(err); }
});

/** Live gateway model catalog (cached). Powers the searchable model picker. */
router.get("/models", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await ensureGatewayModels();
    res.json({
      gatewayConfigured: gatewayEnabled(),
      models: models.map((m) => ({
        id: m.id, provider: m.provider, label: m.label,
        contextWindow: m.contextWindow ?? null, pricing: m.pricing ?? null,
      })),
    });
  } catch (err) { next(err); }
});

router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json(await getAiStatus(user._id));
  } catch (err) { next(err); }
});

router.get("/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const hasActiveKey = Boolean(await AIProviderConfig.exists({ userId: user._id, isActive: true }));
    const admin = await getAdminAiConfig();
    res.json(await usageSummary(user._id, { byok: hasActiveKey, monthlyTokenLimit: admin.monthlyTokenLimit }));
  } catch (err) { next(err); }
});

/* -------------------- validate (no persistence) -------------------- */

// Provider is a free string now (the gateway routes to 40+ providers); the
// catalog derives metadata for any id and validateKey/use-time surfaces errors.
const validateKeySchema = z.object({
  provider: z.string().trim().min(1).max(60),
  key: z.string().min(4),
  /** The model the user picked — validated directly so we test what they'll run,
   *  not a per-provider default that may not exist in their account. */
  model: z.string().trim().max(160).optional(),
});

// SECURITY: the body carries a raw provider key. We never log request bodies in
// this app; on hosted platforms ensure body capture is disabled for this route.
// Rate-limited (30 / 5min / IP) so it can't be used to brute-validate stolen keys.
router.post("/keys/validate", byokValidateLimiter, async (req: Request, res: Response, _next: NextFunction) => {
  const parsed = validateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ ok: false, reason: "Missing provider or API key." });
    return;
  }
  const result = await validateProviderKey(parsed.data.provider, parsed.data.key, parsed.data.model);
  res.json(result);
});

/* -------------------- keys CRUD -------------------- */

const createKeySchema = z.object({
  provider: z.string().trim().min(1).max(60),
  key: z.string().min(8, "API key looks too short"),
  label: z.string().max(80).optional().default(""),
  modelOverride: z.string().max(160).optional().nullable(),
});

const updateKeySchema = z.object({
  label: z.string().max(80).optional(),
  modelOverride: z.string().max(160).nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get("/keys", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const keys = await AIProviderConfig.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    res.json(keys.map(keyView));
  } catch (err) { next(err); }
});

router.post("/keys", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const { provider, key, label, modelOverride } = parsed.data;

    // A newly-added key becomes the single active key for the user.
    await deactivateOthers(user._id);
    const doc = await AIProviderConfig.create({
      userId: user._id,
      provider,
      encryptedKey: encrypt(key),
      last4: key.slice(-4),
      name: label,
      isActive: true,
      modelOverride: modelOverride?.trim() || null,
    });
    res.status(201).json(keyView(doc));
  } catch (err) { next(err); }
});

router.post("/keys/:id/activate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const key = await AIProviderConfig.findOne({ _id: req.params.id, userId: user._id });
    if (!key) throw new NotFoundError("API key");
    // Exactly one active key per user — activating this deactivates the rest.
    await deactivateOthers(user._id, key._id);
    key.isActive = true;
    await key.save();
    res.json(keyView(key));
  } catch (err) { next(err); }
});

router.put("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = updateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const key = await AIProviderConfig.findOne({ _id: req.params.id, userId: user._id });
    if (!key) throw new NotFoundError("API key");

    if (parsed.data.label !== undefined) key.name = parsed.data.label;
    if (parsed.data.modelOverride !== undefined) key.modelOverride = parsed.data.modelOverride?.trim() || null;
    if (parsed.data.isActive === true) {
      await deactivateOthers(user._id, key._id);
      key.isActive = true;
    } else if (parsed.data.isActive === false) {
      key.isActive = false;
    }
    await key.save();
    res.json(keyView(key));
  } catch (err) { next(err); }
});

router.delete("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const key = await AIProviderConfig.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!key) throw new NotFoundError("API key");
    res.json({ message: "API key removed" });
  } catch (err) { next(err); }
});

export default router;
