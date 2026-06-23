/**
 * Central AI runner — the ONLY way the app should call a model.
 *
 * Layers, in order:
 *   1. resolve the model + credential (services/ai/index.ts)
 *   2. content-hash cache lookup (deterministic ops) — a hit skips the call AND
 *      metering, since no tokens were spent
 *   3. per-user monthly quota check for default-key users
 *   4. withAiRetry: backoff + jitter + Retry-After + per-attempt timeout
 *   5. usage metering (tokens + estimated cost)
 *   6. cache store
 *
 * Forwards `providerOptions` (gateway byok + user tag) into the AI SDK call so a
 * user's key is actually applied. Without this wiring the gateway would silently
 * fall back to system credits.
 */
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import mongoose from "mongoose";

import { resolveAi } from "./index.js";
import type { Capability } from "./capability.js";
import { withAiRetry, type RetryOptions } from "./withAiRetry.js";
import { recordUsage } from "./usage.js";
import { assertWithinQuota } from "./usage.js";
import { assertAiRateLimit } from "./rateLimit.js";
import { hashInput, getCached, setCached } from "./cache.js";
import type { AiOpType } from "../../models/AiUsage.js";

interface RunBase {
  userId: string | mongoose.Types.ObjectId;
  capability: Capability;
  opType: AiOpType;
  /** When set, enables content-hash caching keyed on this canonical input. */
  cacheInput?: string;
  retry?: RetryOptions;
}

export interface RunResult {
  provider: string;
  modelId: string;
  byok: boolean;
  cached: boolean;
  usage: { tokensIn: number; tokensOut: number };
}

interface Usageish {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

function normalizeUsage(u: Usageish | undefined): { tokensIn: number; tokensOut: number } {
  return {
    tokensIn: u?.inputTokens ?? u?.promptTokens ?? 0,
    tokensOut: u?.outputTokens ?? u?.completionTokens ?? 0,
  };
}

export async function runGenerateObject<S extends z.ZodTypeAny>(
  opts: RunBase & { schema: S; system?: string; prompt: string },
): Promise<{ object: z.infer<S> } & RunResult> {
  type T = z.infer<S>;
  assertAiRateLimit(opts.userId.toString());
  const resolved = await resolveAi(opts.userId, opts.capability);
  const ctx = { provider: resolved.provider, byok: resolved.byok };

  // 2. cache
  let hash: string | null = null;
  if (opts.cacheInput) {
    hash = hashInput(opts.opType, resolved.modelId, opts.cacheInput);
    const hit = await getCached<T>(hash);
    if (hit !== null) {
      return {
        object: hit,
        provider: resolved.provider,
        modelId: resolved.modelId,
        byok: resolved.byok,
        cached: true,
        usage: { tokensIn: 0, tokensOut: 0 },
      };
    }
  }

  // 3. quota (default-key users only)
  if (!resolved.byok) await assertWithinQuota(opts.userId, resolved.monthlyTokenLimit);

  // 4. call with retry/timeout
  const result = await withAiRetry(
    ctx,
    (signal) =>
      generateObject({
        model: resolved.model,
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        abortSignal: signal,
        ...(resolved.providerOptions ? { providerOptions: resolved.providerOptions } : {}),
      }),
    opts.retry,
  );

  const usage = normalizeUsage(result.usage as Usageish);

  // 5. meter
  await recordUsage({
    userId: opts.userId,
    provider: resolved.provider,
    model: resolved.modelId,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    opType: opts.opType,
    byok: resolved.byok,
  });

  // 6. cache store
  if (hash) await setCached(hash, opts.opType, resolved.modelId, result.object);

  return {
    object: result.object as T,
    provider: resolved.provider,
    modelId: resolved.modelId,
    byok: resolved.byok,
    cached: false,
    usage,
  };
}

export async function runGenerateText(
  opts: RunBase & { system?: string; prompt: string; maxOutputTokens?: number },
): Promise<{ text: string } & RunResult> {
  assertAiRateLimit(opts.userId.toString());
  const resolved = await resolveAi(opts.userId, opts.capability);
  const ctx = { provider: resolved.provider, byok: resolved.byok };

  let hash: string | null = null;
  if (opts.cacheInput) {
    hash = hashInput(opts.opType, resolved.modelId, opts.cacheInput);
    const hit = await getCached<string>(hash);
    if (hit !== null) {
      return {
        text: hit,
        provider: resolved.provider,
        modelId: resolved.modelId,
        byok: resolved.byok,
        cached: true,
        usage: { tokensIn: 0, tokensOut: 0 },
      };
    }
  }

  if (!resolved.byok) await assertWithinQuota(opts.userId, resolved.monthlyTokenLimit);

  const result = await withAiRetry(
    ctx,
    (signal) =>
      generateText({
        model: resolved.model,
        system: opts.system,
        prompt: opts.prompt,
        abortSignal: signal,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        ...(resolved.providerOptions ? { providerOptions: resolved.providerOptions } : {}),
      }),
    opts.retry,
  );

  const usage = normalizeUsage(result.usage as Usageish);
  await recordUsage({
    userId: opts.userId,
    provider: resolved.provider,
    model: resolved.modelId,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    opType: opts.opType,
    byok: resolved.byok,
  });
  if (hash) await setCached(hash, opts.opType, resolved.modelId, result.text);

  return {
    text: result.text,
    provider: resolved.provider,
    modelId: resolved.modelId,
    byok: resolved.byok,
    cached: false,
    usage,
  };
}
