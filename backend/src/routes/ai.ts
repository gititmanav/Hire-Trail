/**
 * BYOK management + AI capability discovery.
 *
 * GET  /api/ai/providers      — what providers are available (BYOK or env fallback) + which is active
 * GET  /api/ai/keys           — list user's stored keys (encryptedKey stripped by model toJSON)
 * POST /api/ai/keys           — store a new key for a provider (deactivates previous active key for that provider)
 * PUT  /api/ai/keys/:id       — update name / modelOverride / isActive
 * DELETE /api/ai/keys/:id     — remove a key
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { AIProviderConfig, AI_PROVIDERS } from "../models/AIProviderConfig.js";
import { encrypt } from "../utils/encryption.js";
import { listAvailableProviders, DEFAULT_MODELS } from "../services/ai/index.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

const createKeySchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().min(8, "API key looks too short"),
  name: z.string().max(80).optional().default(""),
  modelOverride: z.string().max(120).optional().nullable(),
});

const updateKeySchema = z.object({
  name: z.string().max(80).optional(),
  modelOverride: z.string().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get("/providers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const available = await listAvailableProviders(user._id);
    res.json({ available, defaults: DEFAULT_MODELS });
  } catch (err) { next(err); }
});

router.get("/keys", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const keys = await AIProviderConfig.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json(keys);
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
    const { provider, apiKey, name, modelOverride } = parsed.data;

    // Deactivate any existing active key for this provider so we have at most one.
    await AIProviderConfig.updateMany(
      { userId: user._id, provider, isActive: true },
      { $set: { isActive: false } }
    );

    const doc = await AIProviderConfig.create({
      userId: user._id,
      provider,
      encryptedKey: encrypt(apiKey),
      name,
      isActive: true,
      modelOverride: modelOverride?.trim() || null,
    });

    res.status(201).json(doc);
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

    if (parsed.data.name !== undefined) key.name = parsed.data.name;
    if (parsed.data.modelOverride !== undefined) key.modelOverride = parsed.data.modelOverride?.trim() || null;

    if (parsed.data.isActive === true) {
      // Activating this key deactivates the others for the same provider.
      await AIProviderConfig.updateMany(
        { userId: user._id, provider: key.provider, isActive: true, _id: { $ne: key._id } },
        { $set: { isActive: false } }
      );
      key.isActive = true;
    } else if (parsed.data.isActive === false) {
      key.isActive = false;
    }

    await key.save();
    res.json(key);
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
