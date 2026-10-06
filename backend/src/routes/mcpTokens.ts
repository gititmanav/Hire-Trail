/**
 * Assistant connections (MCP personal access tokens), for Settings → AI.
 *
 *   GET    /api/mcp-tokens       → the live connections (never the secret)
 *   POST   /api/mcp-tokens       {name, scopes?, expiresInDays?} → {token, secret} — the secret, once
 *   DELETE /api/mcp-tokens/:id   → revoke (immediate)
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { MCP_SCOPES } from "../models/McpToken.js";
import { createToken, listTokens, revokeToken } from "../services/mcp/tokens.js";
import { getAiSettings } from "../services/ai/settings.js";
import { AppError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ tokens: await listTokens(getUser(req)._id) });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().max(60).optional().default(""),
  scopes: z.array(z.enum(MCP_SCOPES)).min(1).optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

router.post("/", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const policy = await getAiSettings();
    if (!policy.mcp.enabled) throw new AppError("HireTrail has switched off assistant connections for now.", 403);
    res.status(201).json(await createToken(getUser(req)._id, { name: parsed.data.name || "Claude Code", scopes: parsed.data.scopes, expiresInDays: parsed.data.expiresInDays ?? null }));
  } catch (err) { next(err); }
});

router.delete("/:id", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeToken(getUser(req)._id, String(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
