/**
 * Walks a JSON-ish value, replacing any field whose key looks sensitive with
 * "[REDACTED]". Used before persisting request bodies into BugReport rows so
 * a leaked password or API key never lands in our admin panel.
 *
 * Matching is substring + case-insensitive — broader than an exact list so
 * variants like "authToken", "RefreshToken", "x-api-key", "ssn_last4" all
 * redact. False positives are fine (admin sees less data); false negatives
 * are the actual risk we're guarding against.
 */
const SENSITIVE_SUBSTRINGS = [
  "password",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth_header",
  "refreshtoken",
  "refresh_token",
  "encryptedkey",
  "encrypted_key",
  "secret",
  "credential",
  "ssn",
  "card",
  "cvv",
  "pin",
];

const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LEN = 500;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((s) => lower.includes(s));
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY_ITEMS).map((v) => sanitize(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) out.push(`…[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? "[REDACTED]" : sanitize(v, depth + 1);
  }
  return out;
}

/** Stringify-and-truncate the sanitized value, bounded so a runaway payload
 *  can't bloat the DB. Empty input returns empty string. */
export function sanitizedPreview(value: unknown, maxChars = 2000): string {
  if (value === undefined || value === null) return "";
  try {
    const json = JSON.stringify(sanitize(value));
    if (!json) return "";
    return json.length > maxChars ? `${json.slice(0, maxChars)}…` : json;
  } catch {
    return "[unserializable]";
  }
}
