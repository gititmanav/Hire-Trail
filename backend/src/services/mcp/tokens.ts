/**
 * Personal access tokens for HireTrail's MCP server.
 *
 * A token is `ht_mcp_` + 32 random bytes (base64url), shown once at creation.
 * Only its SHA-256 is stored, so a leaked database can't be replayed against
 * the API. Revoking is immediate: every MCP request looks the hash up.
 */
import crypto from "crypto";
import mongoose from "mongoose";

import { McpToken, MCP_SCOPES, type IMcpToken, type McpScope } from "../../models/McpToken.js";
import { McpRate } from "../../models/McpRate.js";
import { AppError, NotFoundError } from "../../errors/AppError.js";

const PREFIX = "ht_mcp_";
const MAX_ACTIVE = 5;
/** lastUsedAt is a courtesy, not an audit trail — write it at most this often. */
const TOUCH_EVERY_MS = 5 * 60_000;

export const hashToken = (secret: string) => crypto.createHash("sha256").update(secret).digest("hex");

export interface McpTokenView {
  id: string;
  name: string;
  last4: string;
  scopes: McpScope[];
  lastClient: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export function tokenView(t: IMcpToken): McpTokenView {
  return {
    id: t._id.toString(),
    name: t.name,
    last4: t.last4,
    scopes: t.scopes,
    lastClient: t.lastClient,
    lastUsedAt: t.lastUsedAt,
    expiresAt: t.expiresAt,
    createdAt: t.createdAt,
  };
}

export async function listTokens(userId: mongoose.Types.ObjectId): Promise<McpTokenView[]> {
  const rows = await McpToken.find({ userId, revokedAt: null }).sort({ createdAt: -1 });
  return rows.filter((t) => !t.expiresAt || t.expiresAt > new Date()).map(tokenView);
}

export async function createToken(
  userId: mongoose.Types.ObjectId,
  input: { name: string; scopes?: McpScope[]; expiresInDays?: number | null },
): Promise<{ token: McpTokenView; secret: string }> {
  const active = await McpToken.countDocuments({ userId, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (active >= MAX_ACTIVE) throw new AppError(`You have ${MAX_ACTIVE} assistant connections already. Remove one first.`, 409);
  const scopes = (input.scopes?.length ? input.scopes : [...MCP_SCOPES]).filter((s) => (MCP_SCOPES as readonly string[]).includes(s));
  const secret = PREFIX + crypto.randomBytes(32).toString("base64url");
  const doc = await McpToken.create({
    userId,
    name: input.name.trim().slice(0, 60) || "My assistant",
    tokenHash: hashToken(secret),
    last4: secret.slice(-4),
    scopes,
    expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
  });
  return { token: tokenView(doc), secret };
}

export async function revokeToken(userId: mongoose.Types.ObjectId, id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Connection");
  const r = await McpToken.updateOne({ _id: id, userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!r.matchedCount) throw new NotFoundError("Connection");
}

/** The live token behind a bearer secret, or null. */
export async function verifyToken(secret: string): Promise<IMcpToken | null> {
  if (!secret.startsWith(PREFIX) || secret.length < PREFIX.length + 40) return null;
  const t = await McpToken.findOne({ tokenHash: hashToken(secret), revokedAt: null });
  if (!t || (t.expiresAt && t.expiresAt <= new Date())) return null;
  return t;
}

/** Record use (throttled) and the client's name when it says hello. */
export async function touchToken(t: IMcpToken, client?: string | null): Promise<void> {
  const stale = !t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > TOUCH_EVERY_MS;
  if (!stale && (!client || client === t.lastClient)) return;
  await McpToken.updateOne({ _id: t._id }, { $set: { lastUsedAt: new Date(), ...(client ? { lastClient: client.slice(0, 120) } : {}) } });
}

/**
 * Count one call (and, for a write tool, one write) against this hour's
 * window. Returns false when the call would pass the limit — the counter is
 * incremented first, so concurrent calls can't slip through together.
 */
export async function chargeRate(
  tokenId: mongoose.Types.ObjectId,
  kind: "call" | "write",
  limits: { callsPerHour: number; writesPerHour: number },
): Promise<boolean> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const row = await McpRate.findOneAndUpdate(
    { _id: `${tokenId}:${hour}` },
    {
      $inc: kind === "call" ? { calls: 1 } : { writes: 1 },
      $setOnInsert: { expireAt: new Date(now.getTime() + 2 * 3_600_000) },
    },
    { upsert: true, new: true },
  ).lean();
  return kind === "call" ? row!.calls <= limits.callsPerHour : row!.writes <= limits.writesPerHour;
}
