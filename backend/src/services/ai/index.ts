/**
 * AI provider abstraction over the Vercel AI SDK.
 *
 * `getModelForUser(userId, capability)` returns a configured language model:
 *   1. tries the user's active BYOK key for any provider, preferring fast/smart match
 *   2. falls back to env-default keys
 *
 * Capabilities split the model selection into "fast" (parsing, classification,
 * gmail intake) and "smart" (resume tailoring). Cheap by default; users can
 * override per-provider via `modelOverride` on AIProviderConfig.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import mongoose from "mongoose";

import { AIProviderConfig, AI_PROVIDERS } from "../../models/AIProviderConfig.js";
import type { AIProvider } from "../../models/AIProviderConfig.js";
import { decrypt } from "../../utils/encryption.js";
import { env } from "../../config/env.js";

export type Capability = "fast" | "smart";

interface ResolvedModel {
  model: LanguageModel;
  provider: AIProvider;
  modelId: string;
  /** True when using user's own key, false when falling back to env default. */
  byok: boolean;
}

const DEFAULT_MODELS: Record<AIProvider, Record<Capability, string>> = {
  anthropic: { fast: "claude-haiku-4-5", smart: "claude-sonnet-4-6" },
  openai: { fast: "gpt-4o-mini", smart: "gpt-4o" },
  google: { fast: "gemini-2.5-flash", smart: "gemini-2.5-flash" },
  openrouter: { fast: "anthropic/claude-haiku-4.5", smart: "anthropic/claude-sonnet-4.6" },
};

/** Preference order when no user keys exist — picked by what env defaults are configured.
 *  Google leads because Gemini Flash has a generous free tier, keeping default-user inference
 *  free for us. Both fast and smart capabilities use gemini-2.5-flash on the Google provider —
 *  gemini-2.5-pro has no free quota, so we'd 429 immediately for default users. Users wanting
 *  Pro can enable billing and set `modelOverride` to "gemini-2.5-pro" on their AIProviderConfig.
 *  Anthropic/OpenAI take over only if a Google key isn't set, and BYOK users override this. */
const FALLBACK_ORDER: AIProvider[] = ["google", "anthropic", "openai", "openrouter"];

function envKeyFor(provider: AIProvider): string {
  switch (provider) {
    case "anthropic": return env.ANTHROPIC_API_KEY;
    case "openai": return env.OPENAI_API_KEY;
    case "google": return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openrouter": return env.OPENROUTER_API_KEY;
  }
}

function instantiate(provider: AIProvider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey }).chat(modelId);
  }
}

/**
 * Resolve a language model for a user.
 *
 * Priority:
 *   1. user has an active BYOK key (any provider) → use the first one we find,
 *      preferring anthropic > openai > google > openrouter
 *   2. fall back to first provider whose env default key is set
 *
 * Throws when nothing is configured (no BYOK keys + no env defaults).
 */
export async function getModelForUser(userId: string | mongoose.Types.ObjectId, capability: Capability): Promise<ResolvedModel> {
  const userKeys = await AIProviderConfig.find({ userId, isActive: true }).lean();

  // Preference order also applies to user's keys when they have multiple providers.
  for (const provider of FALLBACK_ORDER) {
    const cfg = userKeys.find((k) => k.provider === provider);
    if (!cfg) continue;
    try {
      const apiKey = decrypt(cfg.encryptedKey);
      const modelId = cfg.modelOverride?.trim() || DEFAULT_MODELS[provider][capability];
      return { model: instantiate(provider, apiKey, modelId), provider, modelId, byok: true };
    } catch (err) {
      // Decryption failed (rotated key?) — skip and try the next provider.
      console.error(`[ai] decrypt failed for user ${userId} provider ${provider}:`, err);
      continue;
    }
  }

  for (const provider of FALLBACK_ORDER) {
    const apiKey = envKeyFor(provider);
    if (!apiKey) continue;
    const modelId = DEFAULT_MODELS[provider][capability];
    return { model: instantiate(provider, apiKey, modelId), provider, modelId, byok: false };
  }

  throw new Error("No AI provider configured. Add a BYOK key in Settings or set an env default.");
}

/** Returns the list of providers available to this user (either via BYOK or env fallback). */
export async function listAvailableProviders(userId: string | mongoose.Types.ObjectId): Promise<{ provider: AIProvider; byok: boolean }[]> {
  const userKeys = await AIProviderConfig.find({ userId, isActive: true }, { provider: 1 }).lean();
  const result: { provider: AIProvider; byok: boolean }[] = [];
  for (const provider of AI_PROVIDERS) {
    if (userKeys.some((k) => k.provider === provider)) result.push({ provider, byok: true });
    else if (envKeyFor(provider)) result.push({ provider, byok: false });
  }
  return result;
}

export { DEFAULT_MODELS };
