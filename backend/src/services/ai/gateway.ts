/**
 * The AI gateway — the ONE way HireTrail talks to a model.
 *
 *   runAiObject / runAiText(user, featureId, input)
 *     1. resolve the lane, key and model (routing.ts); refusals are ledgered
 *     2. cache (pure-function answers only; keyed on the prompt version)
 *     3. reserve the worst-case cost against the Included budget (ledger.ts)
 *     4. call the provider through the AI SDK with a hard time budget; one
 *        quick retry for a busy or unreachable provider if time allows
 *     5. settle the ledger row, stamp the key's health, store the cache
 *     6. return the parsed answer — or throw an AiError whose copy is ready
 *        to show a person
 *
 * Callers never import a provider SDK, never see a key, and never parse a
 * provider's error text. Long work belongs in a job (jobs.ts), which hands
 * its remaining time down as `budgetMs`.
 */
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { User, type IUser } from "../../models/User.js";
import { periodResetsAt } from "../../models/AiUsage.js";
import { aiFeature, type AiTier } from "./registry.js";
import { resolveRoute } from "./routing.js";
import { AI_PROVIDERS } from "./providers.js";
import { AiError, classifyProviderError, KEY_HEALTH_CODES, TRANSIENT_CODES, keyHealthMessage, type AiErrorCode } from "./errors.js";
import { cacheKey, getCached, setCached } from "./cache.js";
import { costUsd, ensurePriceCatalog, estimateTokens } from "./pricing.js";
import { recordCacheHit, recordRefusal, reserve, settle, type LedgerBase } from "./ledger.js";
import { stampKeyHealth } from "./keys.js";
import type { AiLane, AiProviderId } from "./providerIds.js";

export type AiUser = Pick<IUser, "_id" | "email"> & { aiOverride?: IUser["aiOverride"] };

/** Load what the gateway needs about a user from just their id (workers). */
export async function loadAiUser(userId: mongoose.Types.ObjectId | string): Promise<AiUser> {
  const user = await User.findById(userId).select("email aiOverride").lean();
  if (!user) throw new AiError("not_allowed", { custom: "This account no longer exists." });
  return user as AiUser;
}

interface AiCallOptions {
  system: string;
  prompt: string;
  /** Override the registry's output cap for this call. */
  maxOutputTokens?: number;
  /** Cache the answer by content. Default: on for structured calls. */
  cache?: boolean;
  jobId?: mongoose.Types.ObjectId | null;
  /** Counts toward a per-feature Included limit. Default true; chunked work
   *  passes false for every call after the first. */
  countsAsUse?: boolean;
  /** Time left for this call (a job passes what remains of its own budget). */
  budgetMs?: number;
  /** Use the provider's default for this tier instead of the feature's. */
  tier?: AiTier;
  signal?: AbortSignal;
}

export interface AiCallResult<T> {
  data: T;
  text: string;
  provider: AiProviderId;
  model: string;
  lane: AiLane;
  cached: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const MIN_RETRY_WINDOW_MS = 8_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(
  user: AiUser,
  featureId: string,
  opts: AiCallOptions,
  schema: z.ZodTypeAny | null,
): Promise<AiCallResult<T>> {
  const feature = aiFeature(featureId);
  const started = Date.now();
  // Never plan past the host's function limit: a call it would kill mid-flight
  // leaves no answer and an unsettled hold; our own deadline leaves a clean error.
  const hostCap = env.FUNCTION_MAX_DURATION_S * 1000 - 20_000;
  const deadline = started + Math.min(opts.budgetMs ?? feature.budgetMs, feature.budgetMs, hostCap);
  void ensurePriceCatalog();

  const route = await resolveRoute(user, featureId, { tier: opts.tier });
  const featureLabel = feature.label;
  if (route.kind === "assistant") {
    throw new AiError("assistant_lane", { lane: "assistant", feature: featureId, featureLabel });
  }
  if (route.kind === "refuse") {
    await recordRefusal(
      { userId: user._id, feature: featureId, lane: route.lane ?? "included", provider: "none", model: "", promptVersion: feature.promptVersion, jobId: opts.jobId ?? null },
      route.code,
    );
    throw new AiError(route.code, { lane: route.lane, feature: featureId, featureLabel, custom: route.custom, resetsAt: periodResetsAt().toISOString() });
  }

  const { lane, provider, model, key, secret, policy } = route;
  const providerLabel = AI_PROVIDERS[provider].label;
  const base: LedgerBase = {
    userId: user._id,
    feature: featureId,
    lane,
    provider,
    model,
    keyId: key._id,
    promptVersion: feature.promptVersion,
    jobId: opts.jobId ?? null,
    countsAsUse: opts.countsAsUse ?? true,
  };

  // Cache: pure-function answers about PUBLIC content only (job postings). An
  // answer built from a resume or an email is personal data, and the cache is
  // keyed by content, not by person — account deletion couldn't reach it.
  const useCache = (opts.cache ?? !!schema) && !!schema && feature.dataClass === "posting";
  const hash = useCache
    ? cacheKey({ feature: featureId, promptVersion: feature.promptVersion, provider, model, input: `${opts.system}\n\n${opts.prompt}` })
    : null;
  if (hash) {
    const hit = await getCached<T>(hash);
    if (hit !== null) {
      await recordCacheHit(base);
      return { data: hit, text: "", provider, model, lane, cached: true, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    }
  }

  // Reserve the worst case against the Included budget.
  const maxOut = opts.maxOutputTokens ?? feature.maxOutputTokens;
  const worstCase = costUsd(provider, model, estimateTokens(opts.system + opts.prompt), maxOut);
  const hold = await reserve(base, worstCase, policy, {
    allowanceUsd: user.aiOverride?.allowanceUsd ?? null,
    featureLimit: policy.features[featureId].includedMonthlyLimit,
  });
  if (!hold.ok) {
    throw new AiError(hold.refusal.code, { lane, feature: featureId, featureLabel, limit: hold.refusal.limit, resetsAt: periodResetsAt().toISOString() });
  }

  let languageModel: LanguageModel;
  try {
    languageModel = AI_PROVIDERS[provider].model(secret, model);
  } catch (err) {
    await settle(hold.reservation, { ok: false, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, errorCode: "unsupported" });
    throw new AiError("unsupported", { lane, feature: featureId, featureLabel, providerLabel, detail: String(err) });
  }

  // Tokens the provider billed across attempts — a failed parse is still paid for.
  let billedIn = 0;
  let billedOut = 0;
  const bill = (usage: { inputTokens?: number; outputTokens?: number } | undefined) => {
    billedIn += usage?.inputTokens ?? 0;
    billedOut += usage?.outputTokens ?? 0;
  };

  let lastCode: AiErrorCode = "provider_down";
  let lastDetail = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 1_000) {
      lastCode = "timeout";
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    const onOuterAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
    try {
      const result = await generateText({
        model: languageModel,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: maxOut,
        maxRetries: 0, // the SDK's retries would spend our time budget twice
        abortSignal: controller.signal,
        ...(schema ? { output: Output.object({ schema }) } : {}),
      });
      bill(result.usage);
      const data = (schema ? result.output : result.text) as T;
      const spent = costUsd(provider, model, billedIn, billedOut);
      await settle(hold.reservation, { ok: true, tokensIn: billedIn, tokensOut: billedOut, costUsd: spent, latencyMs: Date.now() - started });
      if (key.lastError) await stampKeyHealth(key._id, null);
      if (hash) await setCached(hash, featureId, model, data);
      return { data, text: result.text, provider, model, lane, cached: false, tokensIn: billedIn, tokensOut: billedOut, costUsd: spent };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) bill(err.usage);
      const classified = opts.signal?.aborted ? { code: "aborted" as AiErrorCode, detail: "aborted" } : classifyProviderError(err);
      lastCode = classified.code;
      lastDetail = classified.detail;
      // One more try when it can plausibly go differently: a busy or unreachable
      // provider, or a malformed answer that wasn't simply cut off at the cap.
      const cutOff = NoObjectGeneratedError.isInstance(err) && err.finishReason === "length";
      const retryable = TRANSIENT_CODES.includes(lastCode) || (lastCode === "parse" && !cutOff);
      if (attempt === 1 && retryable && deadline - Date.now() > MIN_RETRY_WINDOW_MS) {
        if (lastCode !== "parse") await sleep(Math.min(classified.retryAfterMs ?? 1_500, 4_000));
        continue;
      }
      if (cutOff) lastDetail = `cut off at ${maxOut} output tokens`;
      break;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  const spent = costUsd(provider, model, billedIn, billedOut);
  await settle(hold.reservation, { ok: false, tokensIn: billedIn, tokensOut: billedOut, costUsd: spent, latencyMs: Date.now() - started, errorCode: lastCode });
  if (KEY_HEALTH_CODES.includes(lastCode)) {
    await stampKeyHealth(key._id, keyHealthMessage(lastCode, providerLabel));
  }
  console.warn(`[ai] ${featureId} on ${provider}/${model} failed (${lastCode}): ${lastDetail}`);
  throw new AiError(lastCode, { lane, feature: featureId, featureLabel, providerLabel, detail: lastDetail });
}

/** A structured answer, validated against `schema`. */
export function runAiObject<S extends z.ZodTypeAny>(
  user: AiUser,
  featureId: string,
  opts: AiCallOptions & { schema: S },
): Promise<AiCallResult<z.infer<S>>> {
  return call<z.infer<S>>(user, featureId, opts, opts.schema);
}

/** Free text. Not cached unless asked. */
export function runAiText(user: AiUser, featureId: string, opts: AiCallOptions): Promise<AiCallResult<string>> {
  return call<string>(user, featureId, { cache: false, ...opts }, null);
}
