/**
 * Runtime, DB-backed admin AI configuration (task 2).
 *
 * Reads the `ai_*` SystemSettings rows and the encrypted default key, with a
 * short in-process cache so the resolver doesn't hit Mongo on every model call.
 * Writes go through `setAdminAiConfig` / `setDefaultKey`, which bust the cache.
 *
 * The decrypted default key NEVER leaves this module except into the gateway
 * byok payload (services/ai/index.ts). Routes get `publicAdminAiConfig()`, which
 * exposes only non-secret fields + a `hasDefaultKey` boolean + last4.
 */
import { SystemSettings, DEFAULT_SETTINGS } from "../../models/SystemSettings.js";
import { encrypt, decrypt } from "../../utils/encryption.js";

export interface AdminAiConfig {
  enabled: boolean;
  /** Curated or dynamic gateway provider id, or "" when unset. */
  defaultProvider: string;
  defaultModel: string;
  usesGatewayCredits: boolean;
  monthlyTokenLimit: number;
  /** Decrypted default key (or "" when none / unusable). Internal use only. */
  defaultKey: string;
  last4: string;
}

const CACHE_TTL_MS = 30_000;
let cache: { value: AdminAiConfig; at: number } | null = null;

/** Build a lookup of DEFAULT_SETTINGS for fallback when a key isn't in the DB. */
const DEFAULTS = new Map(DEFAULT_SETTINGS.map((s) => [s.key, s.value]));

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function bustAdminAiConfigCache(): void {
  cache = null;
}

export async function getAdminAiConfig(): Promise<AdminAiConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const rows = await SystemSettings.find({ key: { $regex: /^ai_/ } }).lean();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const get = (k: string) => (map.has(k) ? map.get(k) : DEFAULTS.get(k));

  let defaultKey = "";
  let last4 = "";
  const enc = asStr(get("ai_default_key_encrypted"));
  if (enc) {
    try {
      defaultKey = decrypt(enc);
      last4 = defaultKey.slice(-4);
    } catch {
      defaultKey = ""; // rotated ENCRYPTION_KEY → treat as no key
    }
  }

  // Any gateway provider id is allowed (curated or dynamic); "" = unset.
  const defaultProvider = asStr(get("ai_default_provider")).trim();

  const value: AdminAiConfig = {
    enabled: asBool(get("ai_enabled"), true),
    defaultProvider,
    defaultModel: asStr(get("ai_default_model")).trim(),
    usesGatewayCredits: asBool(get("ai_default_uses_gateway_credits"), false),
    monthlyTokenLimit: Math.max(0, asNum(get("ai_default_monthly_token_limit"), 200_000)),
    defaultKey,
    last4,
  };
  cache = { value, at: Date.now() };
  return value;
}

/** Non-secret view for admin/status routes. */
export async function publicAdminAiConfig(): Promise<{
  enabled: boolean;
  defaultProvider: string;
  defaultModel: string;
  usesGatewayCredits: boolean;
  monthlyTokenLimit: number;
  hasDefaultKey: boolean;
  defaultKeyLast4: string;
}> {
  const c = await getAdminAiConfig();
  return {
    enabled: c.enabled,
    defaultProvider: c.defaultProvider,
    defaultModel: c.defaultModel,
    usesGatewayCredits: c.usesGatewayCredits,
    monthlyTokenLimit: c.monthlyTokenLimit,
    hasDefaultKey: Boolean(c.defaultKey),
    defaultKeyLast4: c.last4,
  };
}

async function setSetting(key: string, value: unknown, adminId: unknown): Promise<void> {
  await SystemSettings.updateOne({ key }, { $set: { value, updatedBy: adminId ?? null } }, { upsert: true });
}

/** Patch any of the non-secret admin AI toggles. Unspecified fields are left as-is. */
export async function setAdminAiConfig(
  patch: Partial<{
    enabled: boolean;
    defaultProvider: string;
    defaultModel: string;
    usesGatewayCredits: boolean;
    monthlyTokenLimit: number;
  }>,
  adminId: unknown,
): Promise<void> {
  if (patch.enabled !== undefined) await setSetting("ai_enabled", patch.enabled, adminId);
  if (patch.defaultProvider !== undefined) await setSetting("ai_default_provider", patch.defaultProvider, adminId);
  if (patch.defaultModel !== undefined) await setSetting("ai_default_model", patch.defaultModel, adminId);
  if (patch.usesGatewayCredits !== undefined) await setSetting("ai_default_uses_gateway_credits", patch.usesGatewayCredits, adminId);
  if (patch.monthlyTokenLimit !== undefined) await setSetting("ai_default_monthly_token_limit", Math.max(0, patch.monthlyTokenLimit), adminId);
  bustAdminAiConfigCache();
}

/** Store (or clear) the encrypted admin default key. Pass "" to clear. */
export async function setDefaultKey(rawKey: string, adminId: unknown): Promise<void> {
  const value = rawKey ? encrypt(rawKey) : "";
  await setSetting("ai_default_key_encrypted", value, adminId);
  bustAdminAiConfigCache();
}
