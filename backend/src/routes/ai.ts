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
import { byokValidateLimiter } from "../middleware/rateLimiter.js";

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

/** POST /api/ai/keys/validate — pings the provider with the supplied key to
 *  verify it's valid BEFORE the user saves it. Tries each provider's cheapest
 *  "is this key real?" endpoint:
 *    - Anthropic:   GET https://api.anthropic.com/v1/models
 *    - OpenAI:      GET https://api.openai.com/v1/models
 *    - Google:      GET https://generativelanguage.googleapis.com/v1beta/models?key={KEY}
 *    - OpenRouter:  GET https://openrouter.ai/api/v1/auth/key
 *  Returns { ok: true } on success, otherwise { ok: false, reason: string }.
 *  Never persists anything. Never throws — failure is communicated via JSON.
 */
const validateKeySchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().min(4),
});
// SECURITY: the request body for this route contains a raw API key. If any
// downstream proxy/logger captures request bodies, redact "apiKey" before
// persisting. We don't run a request-body logger in this app today, so the
// surface area is the hosting platform's own logs. Treat this as a known
// constraint; document it in deploy notes.
// RATE LIMIT: 30 requests / 5 minutes / IP. Prevents this endpoint becoming an
// oracle for abusers to validate stolen keys against providers.
router.post("/keys/validate", byokValidateLimiter, async (req: Request, res: Response, _next: NextFunction) => {
  const parsed = validateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ ok: false, reason: "Missing provider or API key." });
    return;
  }
  const { provider, apiKey } = parsed.data;
  try {
    let url = "";
    const headers: Record<string, string> = {};
    if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/models";
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/models";
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider === "google") {
      // Use header auth rather than querystring so the key never appears in
      // URLs, proxy logs, or referer headers. The Generative Language API
      // accepts `x-goog-api-key`.
      url = "https://generativelanguage.googleapis.com/v1beta/models";
      headers["x-goog-api-key"] = apiKey;
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/auth/key";
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      res.json({ ok: false, reason: "Unknown provider." });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(url, { headers, signal: controller.signal });
      if (r.status === 200) { res.json({ ok: true }); return; }
      if (r.status === 401 || r.status === 403) { res.json({ ok: false, reason: "Key was rejected by the provider." }); return; }
      if (r.status === 429) { res.json({ ok: false, reason: "Provider rate limit hit — try again in a moment." }); return; }
      res.json({ ok: false, reason: `Provider returned ${r.status}.` });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    // Don't echo raw provider error messages — they sometimes include URL
    // fragments which (in theory) could expose the key for providers that
    // accept it as a query param. Use a fixed, user-friendly response.
    const e = err as { name?: string };
    if (e?.name === "AbortError") { res.json({ ok: false, reason: "Validation timed out." }); return; }
    res.json({ ok: false, reason: "Could not reach provider." });
  }
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
