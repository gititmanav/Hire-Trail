/** AI error codes the client acts on (no imports — the axios interceptor uses
 *  this, and must not import the API modules built on top of it). */

/** Refusals the person can fix in Settings → AI — their toast offers the way there. */
const FIXABLE_IN_SETTINGS = new Set([
  "ai_off", "ai_needs_key", "ai_limit_reached", "ai_feature_limit", "ai_cap_reached", "ai_assistant_lane", "ai_no_route",
]);

/** For a My key call, a rejected or empty key is the person's to fix too. */
export function aiErrorFixableInSettings(code: string | undefined, lane?: string): boolean {
  if (!code) return false;
  if (FIXABLE_IN_SETTINGS.has(code)) return true;
  return lane === "byok" && (code === "ai_auth" || code === "ai_quota" || code === "ai_unsupported");
}

export function aiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
}
