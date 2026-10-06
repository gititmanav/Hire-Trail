/**
 * The AI error vocabulary — every failure the gateway can produce maps to one
 * of these codes, and `aiErrorMessage` is the ONE place they become words.
 * Clients act on the code (`ai_<code>` in the JSON body), never on the text.
 *
 * Copy depends on the lane, because the fix depends on who owns the key:
 * a rejected key on My key is the user's to fix; on Included it is ours.
 */
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";

import { AppError } from "../../errors/AppError.js";
import type { AiLane } from "./providerIds.js";

export const AI_ERROR_CODES = [
  // Policy refusals (no provider call was made)
  "disabled",       // AI, or this feature, is turned off by the admin
  "off",            // the user turned this feature off
  "not_allowed",    // the lane isn't allowed (suspended, free-tier key + email, …)
  "no_route",       // Included lane, but no platform key powers this feature
  "needs_key",      // My key lane, but the user has no usable key
  "assistant_lane", // the feature runs in the user's assistant (MCP)
  "limit_reached",  // the user's monthly Included allowance is used up
  "feature_limit",  // the per-feature monthly Included count is used up
  "cap_reached",    // the platform's monthly Included cap is used up
  // Provider outcomes
  "auth",
  "quota",
  "rate_limit",
  "provider_down",
  "bad_request",
  "unsupported",
  "parse",
  "timeout",
  "aborted",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Codes worth pinning to the key row as its health (persistent, not weather). */
export const KEY_HEALTH_CODES: AiErrorCode[] = ["auth", "quota"];

/** Codes worth one quick retry inside the same call. */
export const TRANSIENT_CODES: AiErrorCode[] = ["rate_limit", "provider_down"];

export interface AiErrorContext {
  lane?: AiLane;
  providerLabel?: string;
  featureLabel?: string;
  /** Admin's pause message, for "disabled" while AI is paused. */
  pauseMessage?: string;
  /** ISO date the monthly limits reset. */
  resetsAt?: string;
  /** Per-feature Included limit, for "feature_limit". */
  limit?: number;
  /** A specific sentence that replaces the generic copy (e.g. why a lane isn't allowed). */
  custom?: string;
}

function resets(ctx: AiErrorContext): string {
  if (!ctx.resetsAt) return "next month";
  const d = new Date(ctx.resetsAt);
  return `on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`;
}

/** Plain-words copy for a code. Written for the person, in ASCII-safe sentences. */
export function aiErrorMessage(code: AiErrorCode, ctx: AiErrorContext = {}): string {
  if (ctx.custom) return ctx.custom;
  const provider = ctx.providerLabel ?? "The AI provider";
  const feature = ctx.featureLabel ?? "This AI feature";
  const own = ctx.lane === "byok";
  switch (code) {
    case "disabled":
      return ctx.pauseMessage?.trim() || `${feature} is turned off right now.`;
    case "off":
      return `${feature} is off for your account. Turn it back on in Settings → AI.`;
    case "not_allowed":
      return `${feature} isn't available on this account. Check Settings → AI.`;
    case "no_route":
      return `${feature} isn't set up on HireTrail yet. You can run it on your own key in Settings → AI.`;
    case "needs_key":
      return `${feature} runs on your own AI key. Add one in Settings → AI.`;
    case "assistant_lane":
      return `${feature} runs in your AI assistant. Ask it in Claude Code (or your connected assistant), or switch this feature in Settings → AI.`;
    case "limit_reached":
      return `You've used this month's included AI (resets ${resets(ctx)}). Add your own key or connect your assistant in Settings → AI to keep going.`;
    case "feature_limit":
      return `You've used this month's ${ctx.limit ?? ""} included ${feature.toLowerCase()} runs (resets ${resets(ctx)}). Your own key or assistant has no limit — set it up in Settings → AI.`.replace("  ", " ");
    case "cap_reached":
      return `HireTrail's included AI is at capacity for this month. Your own key or assistant keeps working — set it up in Settings → AI.`;
    case "auth":
      return own
        ? `${provider} rejected your key — it may have been revoked. Check it in Settings → AI.`
        : `HireTrail's ${provider} key was rejected. We've been told; try again later or use your own key.`;
    case "quota":
      return own
        ? `Your ${provider} account is out of credit. Top it up or switch keys in Settings → AI.`
        : `HireTrail's ${provider} account is out of credit for now. Your own key keeps working.`;
    case "rate_limit":
      return `${provider} is busy right now. Wait a moment and try again.`;
    case "provider_down":
      return `${provider} didn't answer. Try again in a minute.`;
    case "bad_request":
      return `${provider} couldn't process this request.`;
    case "unsupported":
      return own
        ? `The model chosen for this can't handle it. Pick a different model in Settings → AI.`
        : `The model set up for this can't handle it. Try again later.`;
    case "parse":
      return `The AI answered in a shape HireTrail couldn't read. Try again.`;
    case "timeout":
      return `The AI took too long. Try again${own ? ", or pick a faster model in Settings → AI" : ""}.`;
    case "aborted":
      return "Stopped.";
  }
}

/** A key's health line (shown beside the key, so it never says "go to settings"). */
export function keyHealthMessage(code: AiErrorCode, providerLabel: string): string {
  if (code === "quota") return `This ${providerLabel} account is out of credit.`;
  return `${providerLabel} rejected this key — it may have been revoked or mistyped.`;
}

const HTTP_STATUS: Record<AiErrorCode, number> = {
  disabled: 403, off: 403, not_allowed: 403, no_route: 503, needs_key: 409, assistant_lane: 409,
  limit_reached: 429, feature_limit: 429, cap_reached: 429,
  auth: 502, quota: 502, rate_limit: 429, provider_down: 502, bad_request: 502,
  unsupported: 502, parse: 502, timeout: 504, aborted: 499,
};

/** A gateway failure. The JSON body carries `code: "ai_<code>"` and details
 *  the client can act on (the lane, the feature) — never provider text. */
export class AiError extends AppError {
  public readonly aiCode: AiErrorCode;
  public readonly lane?: AiLane;
  /** Provider's own words, for logs and the ledger only. */
  public readonly detail?: string;

  constructor(code: AiErrorCode, ctx: AiErrorContext & { feature?: string; detail?: string } = {}) {
    super(aiErrorMessage(code, ctx), HTTP_STATUS[code], {
      code: `ai_${code}`,
      details: { ...(ctx.lane && { lane: ctx.lane }), ...(ctx.feature && { feature: ctx.feature }) },
    });
    this.aiCode = code;
    this.lane = ctx.lane;
    this.detail = ctx.detail;
  }
}

export function isAiError(e: unknown): e is AiError {
  return e instanceof AiError;
}

/** Normalize anything thrown by an AI SDK call (or our abort) to a code. */
export function classifyProviderError(err: unknown): { code: AiErrorCode; detail: string; retryAfterMs?: number } {
  const detail = (err as { message?: string })?.message?.slice(0, 300) ?? String(err);
  if (err instanceof AiError) return { code: err.aiCode, detail };
  const name = (err as { name?: string })?.name;
  if (name === "AbortError" || name === "TimeoutError") return { code: "timeout", detail };
  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
    return { code: "parse", detail };
  }
  if (APICallError.isInstance(err)) {
    const status = err.statusCode ?? 0;
    const body = `${err.responseBody ?? ""} ${err.message}`.toLowerCase();
    const retryAfter = Number(err.responseHeaders?.["retry-after"]);
    const retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined;
    if (status === 401 || status === 403) return { code: "auth", detail };
    if (status === 402) return { code: "quota", detail };
    if (status === 429) {
      // OpenAI and others answer 429 for an empty balance too.
      if (/insufficient_quota|quota|credit|billing|balance/.test(body)) return { code: "quota", detail };
      return { code: "rate_limit", detail, retryAfterMs };
    }
    if (status === 400 && /api[ _-]?key|invalid.*key|unauthori[sz]ed/.test(body)) return { code: "auth", detail };
    if (status === 400 || status === 422) {
      if (/not support|unsupported|does not support|modality|json_schema/.test(body)) return { code: "unsupported", detail };
      if (/model.*(not found|does not exist)|unknown model/.test(body)) return { code: "unsupported", detail };
      return { code: "bad_request", detail };
    }
    if (status === 404) return { code: "unsupported", detail };
    if (status === 408) return { code: "timeout", detail };
    if (status >= 500) return { code: "provider_down", detail };
    return { code: "bad_request", detail };
  }
  const cause = (err as { cause?: { code?: string } })?.cause?.code;
  if (cause && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(cause)) {
    return { code: "provider_down", detail };
  }
  if (/fetch failed|network/i.test(detail)) return { code: "provider_down", detail };
  return { code: "bad_request", detail };
}
