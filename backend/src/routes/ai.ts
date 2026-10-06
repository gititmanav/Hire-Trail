/**
 * My AI — the person's side of the AI layer.
 *
 *   GET    /api/ai/me                    → the whole map: features (lane, key,
 *                                           model, lock, activity), keys,
 *                                           included, assistant, usage
 *   PUT    /api/ai/features/:feature     {lane, keyId?, model?} → move it
 *   DELETE /api/ai/features/:feature     → back to the default
 *   PUT    /api/ai/default-key           {keyId}
 *   POST   /api/ai/keys                  {provider, name, secret, freeTier?} → tested on save
 *   PATCH  /api/ai/keys/:id              {name?, freeTier?, secret?} (secret = rotate, tested first)
 *   POST   /api/ai/keys/:id/check        → re-test the stored key
 *   GET    /api/ai/keys/:id/models       → the key's live model list
 *   DELETE /api/ai/keys/:id
 *   GET    /api/ai/usage                 → this month
 *   GET    /api/ai/jobs/:id              → an AI job's status
 *   POST   /api/ai/jobs/:id/cancel
 *
 * Keys never leave as ciphertext or plaintext — only nickname, provider,
 * last four and health. The demo account can read (to draw the empty map)
 * but never writes or reaches a provider.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { byokValidateLimiter } from "../middleware/rateLimiter.js";
import { AiJob } from "../models/AiJob.js";
import { User } from "../models/User.js";
import { NotFoundError } from "../errors/AppError.js";
import { AI_PROVIDER_IDS, AI_LANES } from "../services/ai/providerIds.js";
import { addKey, checkKey, deleteKey, modelsForKey, updateKey } from "../services/ai/keys.js";
import { ensureDefaultRoute } from "../services/ai/routing.js";
import { getAiSettings } from "../services/ai/settings.js";
import { userUsage } from "../services/ai/ledger.js";
import { cancelAiJob, jobView, reviveAiJobs } from "../services/ai/jobs.js";
import { resetUserFeatureRoute, setUserDefaultKey, setUserFeatureRoute, userAiMap } from "../services/ai/map.js";
import type { AiUser } from "../services/ai/gateway.js";

const router = Router();
router.use(ensureAuth);
router.post(/.*/, blockDemoUser);
router.put(/.*/, blockDemoUser);
router.patch(/.*/, blockDemoUser);
router.delete(/.*/, blockDemoUser);

/** The gateway's view of the signed-in user (email + admin overrides). */
async function aiUser(req: Request): Promise<AiUser> {
  const user = getUser(req);
  const full = await User.findById(user._id).select("email aiOverride").lean();
  return (full ?? { _id: user._id, email: user.email }) as AiUser;
}

const badRequest = (res: Response, err: z.ZodError) => res.status(400).json({ error: err.flatten().fieldErrors });

router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await userAiMap(await aiUser(req)));
  } catch (err) { next(err); }
});

/* ---------------- the map ---------------- */

const routeSchema = z.object({
  lane: z.enum(AI_LANES),
  keyId: z.string().nullable().optional(),
  model: z.string().max(160).nullable().optional(),
});

router.put("/features/:feature", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = routeSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const user = await aiUser(req);
    await setUserFeatureRoute(user, String(req.params.feature), parsed.data);
    res.json(await userAiMap(user));
  } catch (err) { next(err); }
});

router.delete("/features/:feature", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await aiUser(req);
    await resetUserFeatureRoute(user, String(req.params.feature));
    res.json(await userAiMap(user));
  } catch (err) { next(err); }
});

router.put("/default-key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ keyId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const user = await aiUser(req);
    await setUserDefaultKey(user, parsed.data.keyId);
    res.json(await userAiMap(user));
  } catch (err) { next(err); }
});

/* ---------------- keys ---------------- */

const addKeySchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  name: z.string().max(60).optional().default(""),
  secret: z.string().min(1).max(4096),
  freeTier: z.boolean().optional(),
});

router.post("/keys", byokValidateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addKeySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const user = getUser(req);
    const { key, note } = await addKey({ owner: "user", userId: user._id }, parsed.data, user._id);
    await ensureDefaultRoute("user", user._id, new mongoose.Types.ObjectId(key.id));
    res.status(201).json({ key, note });
  } catch (err) { next(err); }
});

const patchKeySchema = z.object({
  name: z.string().max(60).optional(),
  freeTier: z.boolean().optional(),
  secret: z.string().min(1).max(4096).optional(),
});

router.patch("/keys/:id", byokValidateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = patchKeySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const user = getUser(req);
    res.json(await updateKey({ owner: "user", userId: user._id }, String(req.params.id), parsed.data));
  } catch (err) { next(err); }
});

router.post("/keys/:id/check", byokValidateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ key: await checkKey({ owner: "user", userId: user._id }, String(req.params.id)) });
  } catch (err) { next(err); }
});

router.get("/keys/:id/models", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ models: await modelsForKey({ owner: "user", userId: user._id }, String(req.params.id)) });
  } catch (err) { next(err); }
});

router.delete("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const result = await deleteKey({ owner: "user", userId: user._id }, String(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
});

/* ---------------- usage + jobs ---------------- */

router.get("/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await aiUser(req);
    res.json(await userUsage(user._id, await getAiSettings(), user.aiOverride?.allowanceUsd ?? null));
  } catch (err) { next(err); }
});

router.get("/jobs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new NotFoundError("AI job");
    await reviveAiJobs(user._id);
    const job = await AiJob.findOne({ _id: req.params.id, userId: user._id });
    if (!job) throw new NotFoundError("AI job");
    res.json(jobView(job));
  } catch (err) { next(err); }
});

router.post("/jobs/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const ok = await cancelAiJob(String(req.params.id), user._id);
    if (!ok) throw new NotFoundError("Running AI job");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
