/**
 * Admin AI control (task 2). DB-backed, runtime — no redeploy needed.
 *
 *   GET    /api/admin/ai          → current config (no secret) + gateway status
 *   PUT    /api/admin/ai          → toggle enabled / default provider+model /
 *                                    gateway-credits mode / per-user token quota
 *   PUT    /api/admin/ai/key      {provider, key} → validate + store default key
 *   DELETE /api/admin/ai/key      → clear the default key
 *   GET    /api/admin/ai/usage    → org-wide usage rollup for the current period
 *
 * The default key is encrypted at rest and never returned; only its last4 +
 * presence are exposed.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { getUser } from "../../middleware/auth.js";
import { AiUsage, currentPeriod } from "../../models/AiUsage.js";
import {
  publicAdminAiConfig,
  setAdminAiConfig,
  setDefaultKey,
} from "../../services/ai/adminConfig.js";
import { gatewayEnabled } from "../../services/ai/index.js";
import { validateProviderKey } from "../../services/ai/validateKey.js";

const router = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ config: await publicAdminAiConfig(), gatewayConfigured: gatewayEnabled() });
  } catch (err) { next(err); }
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  defaultProvider: z.string().trim().max(60).optional(), // "" clears; any gateway provider id
  defaultModel: z.string().max(160).optional(),
  usesGatewayCredits: z.boolean().optional(),
  monthlyTokenLimit: z.number().int().min(0).optional(),
});
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    await setAdminAiConfig(parsed.data, admin._id);
    res.json({ config: await publicAdminAiConfig() });
  } catch (err) { next(err); }
});

const keySchema = z.object({
  provider: z.string().trim().min(1).max(60),
  key: z.string().min(4),
  /** Skip the live provider check (e.g. when the gateway isn't reachable). */
  skipValidation: z.boolean().optional(),
});
router.put("/key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const parsed = keySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const { provider, key, skipValidation } = parsed.data;
    if (!skipValidation) {
      const check = await validateProviderKey(provider, key);
      if (!check.ok) {
        res.status(400).json({ error: check.reason || "Key validation failed.", modelTested: check.modelTested });
        return;
      }
    }
    await setDefaultKey(key, admin._id);
    await setAdminAiConfig({ defaultProvider: provider }, admin._id);
    res.json({ config: await publicAdminAiConfig() });
  } catch (err) { next(err); }
});

router.delete("/key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    await setDefaultKey("", admin._id);
    res.json({ config: await publicAdminAiConfig() });
  } catch (err) { next(err); }
});

router.get("/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : currentPeriod();
    const [totals, byProvider, topUsers] = await Promise.all([
      AiUsage.aggregate([
        { $match: { period } },
        { $group: { _id: null, tokensIn: { $sum: "$tokensIn" }, tokensOut: { $sum: "$tokensOut" }, estCostUsd: { $sum: "$estCostUsd" }, calls: { $sum: 1 } } },
      ]),
      AiUsage.aggregate([
        { $match: { period } },
        { $group: { _id: { provider: "$provider", byok: "$byok" }, tokensIn: { $sum: "$tokensIn" }, tokensOut: { $sum: "$tokensOut" }, estCostUsd: { $sum: "$estCostUsd" }, calls: { $sum: 1 } } },
        { $sort: { estCostUsd: -1 } },
      ]),
      AiUsage.aggregate([
        { $match: { period, byok: false } },
        { $group: { _id: "$userId", totalTokens: { $sum: { $add: ["$tokensIn", "$tokensOut"] } }, estCostUsd: { $sum: "$estCostUsd" } } },
        { $sort: { totalTokens: -1 } },
        { $limit: 20 },
      ]),
    ]);
    res.json({
      period,
      totals: totals[0] ?? { tokensIn: 0, tokensOut: 0, estCostUsd: 0, calls: 0 },
      byProvider,
      topDefaultKeyUsers: topUsers,
    });
  } catch (err) { next(err); }
});

export default router;
