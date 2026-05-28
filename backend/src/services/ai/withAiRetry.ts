/**
 * Wraps a Vercel AI SDK call so transient failures retry once and permanent
 * failures surface a user-actionable message ("Your Anthropic key was rejected
 * — check Settings"). Without this wrapper the routes return generic "Failed
 * to analyze" toasts that give the user no path forward.
 */
import { AppError } from "../../errors/AppError.js";
import type { AIProvider } from "../../models/AIProviderConfig.js";

const PROVIDER_NAMES: Record<AIProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
};

export interface AIErrorContext {
  provider: AIProvider;
  /** True when using user's own key — error copy is more direct ("update your key"). */
  byok: boolean;
}

interface ErrorShape {
  statusCode?: number;
  status?: number;
  message?: string;
  cause?: { code?: string };
}

function statusOf(err: unknown): number | undefined {
  const e = err as ErrorShape;
  return typeof e.statusCode === "number" ? e.statusCode : e.status;
}

function isTransient(err: unknown): boolean {
  const status = statusOf(err);
  if (typeof status === "number") {
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  const code = (err as ErrorShape).cause?.code;
  return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

function friendly(err: unknown, ctx: AIErrorContext): string {
  const status = statusOf(err);
  const name = PROVIDER_NAMES[ctx.provider];

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
  if (typeof status === "number" && status >= 500) {
    return `${name} is having issues right now (HTTP ${status}). Please try again in a minute.`;
  }
  const msg = (err as ErrorShape).message?.slice(0, 200)?.trim();
  return msg ? `${name} request failed: ${msg}` : `${name} request failed unexpectedly. Please try again.`;
}

export class AIProviderError extends AppError {
  public readonly provider: AIProvider;
  public readonly upstreamStatus: number | undefined;
  constructor(message: string, ctx: AIErrorContext, cause: unknown) {
    // 502 Bad Gateway — the upstream provider is the source of the failure.
    // For 4xx user-actionable cases (bad key, out of credit) we still use 502
    // because the failure originated upstream; the message tells the user what to do.
    super(message, 502);
    this.provider = ctx.provider;
    this.upstreamStatus = statusOf(cause);
  }
}

/**
 * Run an AI SDK call with one retry on transient failures, mapping permanent
 * failures to a friendly per-provider message.
 *
 * Usage:
 *   const { object } = await withAiRetry({ provider, byok }, () => generateObject({ model, ... }));
 */
export async function withAiRetry<T>(ctx: AIErrorContext, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransient(err)) throw new AIProviderError(friendly(err, ctx), ctx, err);
    await new Promise((r) => setTimeout(r, 700));
    try {
      return await fn();
    } catch (err2) {
      throw new AIProviderError(friendly(err2, ctx), ctx, err2);
    }
  }
}
