/**
 * Reliability wrapper around a Vercel AI SDK call (task 4).
 *
 *   - exponential backoff + full jitter between retries
 *   - honors a `Retry-After` header on 429s (caps it so we don't hang forever)
 *   - per-attempt timeout via AbortSignal (passed into generate*)
 *   - 401 / 402 / 403 are NON-retryable (bad key / out of credit) and map to a
 *     friendly, provider-specific, user-actionable message
 *
 * The `attempt` callback receives an AbortSignal it MUST forward to the AI SDK
 * (`generateObject({ ..., abortSignal })`) so the timeout actually cancels the
 * in-flight request rather than just abandoning the promise.
 */
import { AppError } from "../../errors/AppError.js";
import type { AIProvider } from "../../models/AIProviderConfig.js";
import { providerLabel } from "./catalog.js";

export interface AIErrorContext {
  provider: AIProvider | string;
  /** True when using the user's own key — copy says "your key" vs "our key". */
  byok: boolean;
}

export interface RetryOptions {
  /** Total attempts including the first. Default 3 (→ up to 2 retries). */
  maxAttempts?: number;
  /** Base backoff in ms (grows exponentially). Default 600. */
  baseDelayMs?: number;
  /** Hard cap per backoff sleep. Default 8000. */
  maxDelayMs?: number;
  /** Per-attempt timeout. Default 60000. */
  timeoutMs?: number;
}

interface ErrorShape {
  statusCode?: number;
  status?: number;
  message?: string;
  name?: string;
  isRetryable?: boolean;
  responseHeaders?: Record<string, string> | Headers;
  cause?: { code?: string };
}

function statusOf(err: unknown): number | undefined {
  const e = err as ErrorShape;
  return typeof e.statusCode === "number" ? e.statusCode : e.status;
}

function headerValue(headers: ErrorShape["responseHeaders"], name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** Parse a Retry-After header (seconds or HTTP-date) → ms, or undefined. */
function retryAfterMs(err: unknown): number | undefined {
  const raw = headerValue((err as ErrorShape).responseHeaders, "retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function isTimeoutAbort(err: unknown): boolean {
  const e = err as ErrorShape;
  return e?.name === "AbortError" || e?.name === "TimeoutError";
}

function isTransient(err: unknown): boolean {
  // The AI SDK / gateway sometimes annotate retryability directly.
  const flagged = (err as ErrorShape).isRetryable;
  if (typeof flagged === "boolean") return flagged;
  if (isTimeoutAbort(err)) return true;
  const status = statusOf(err);
  if (typeof status === "number") {
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false; // 400/401/402/403/404 etc. are permanent
  }
  const code = (err as ErrorShape).cause?.code;
  return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

function friendly(err: unknown, ctx: AIErrorContext): string {
  const status = statusOf(err);
  const name = providerLabel(ctx.provider);

  if (status === 401 || status === 403) {
    return ctx.byok
      ? `Your ${name} API key was rejected. Update it in Settings → AI Providers.`
      : `${name} rejected our server key. Add your own key in Settings → AI Providers to keep using this feature.`;
  }
  if (status === 402) {
    return ctx.byok
      ? `Your ${name} account is out of credit. Top it up or switch providers in Settings → AI Providers.`
      : `Our ${name} quota is temporarily exhausted. Add your own key in Settings → AI Providers to continue.`;
  }
  if (status === 429) {
    return ctx.byok
      ? `${name} rate-limited your account. Wait a moment and try again.`
      : `${name} rate-limited our shared key. Add your own key in Settings → AI Providers, or try again in a few minutes.`;
  }
  if (isTimeoutAbort(err)) {
    return `${name} took too long to respond. Please try again.`;
  }
  if (typeof status === "number" && status >= 500) {
    return `${name} is having issues right now (HTTP ${status}). Please try again in a minute.`;
  }
  const msg = (err as ErrorShape).message?.slice(0, 200)?.trim();
  return msg ? `${name} request failed: ${msg}` : `${name} request failed unexpectedly. Please try again.`;
}

export class AIProviderError extends AppError {
  public readonly provider: string;
  public readonly upstreamStatus: number | undefined;
  constructor(message: string, ctx: AIErrorContext, cause: unknown) {
    // 502: the failure originated upstream; the message tells the user what to do.
    super(message, 502);
    this.provider = String(ctx.provider);
    this.upstreamStatus = statusOf(cause);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with full jitter, capped, honoring Retry-After. */
function backoffMs(attempt: number, opts: Required<RetryOptions>, err: unknown): number {
  const ra = retryAfterMs(err);
  const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  const jittered = Math.random() * exp;
  // If the provider told us how long to wait, respect it (but cap it).
  if (ra !== undefined) return Math.min(opts.maxDelayMs * 2, Math.max(ra, jittered));
  return jittered;
}

export async function withAiRetry<T>(
  ctx: AIErrorContext,
  attempt: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts: Required<RetryOptions> = {
    maxAttempts: options.maxAttempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 600,
    maxDelayMs: options.maxDelayMs ?? 8000,
    timeoutMs: options.timeoutMs ?? 60_000,
  };

  let lastErr: unknown;
  for (let i = 1; i <= opts.maxAttempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      return await attempt(controller.signal);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === opts.maxAttempts) {
        throw new AIProviderError(friendly(err, ctx), ctx, err);
      }
      await sleep(backoffMs(i, opts, err));
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable, but satisfies the type checker.
  throw new AIProviderError(friendly(lastErr, ctx), ctx, lastErr);
}
