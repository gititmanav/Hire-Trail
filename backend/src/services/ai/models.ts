/**
 * Live model lists per key, and choosing a sensible default from them.
 *
 * Lists come from the provider (providers.ts) and are cached per key for an
 * hour in instance memory — a courtesy cache, scoped per key so fixing a key
 * never serves yesterday's failure for long.
 *
 * Choosing a default: the provider's curated hints for the feature's tier,
 * first one that the key can actually use; then a tier heuristic over the
 * live list; then the first hint (the call will surface a clear error if
 * that's wrong). Hints are never trusted blindly — model ids move monthly.
 */
import type { AiProviderId } from "./providerIds.js";
import { AI_PROVIDERS, type AiModelInfo } from "./providers.js";
import type { AiTier } from "./registry.js";

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; models: AiModelInfo[] }>();

/** Cached live list for one key. Throws AiProviderCallError on failure. */
export async function listModelsForKey(keyId: string, provider: AiProviderId, secret: string): Promise<AiModelInfo[]> {
  const hit = cache.get(keyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.models;
  const models = await AI_PROVIDERS[provider].listModels(secret);
  cache.set(keyId, { at: Date.now(), models });
  return models;
}

export function forgetModels(keyId: string): void {
  cache.delete(keyId);
}

export function cachedModels(keyId: string): AiModelInfo[] | null {
  const hit = cache.get(keyId);
  return hit && Date.now() - hit.at < TTL_MS ? hit.models : null;
}

const FAST = /(lite|nano|mini|small|haiku|instant|flash|8b|20b)/i;
const SMART = /(flash|sonnet|medium|pro|large|70b|120b|grok-4|gpt-5|chat)/i;
const AVOID = /(preview|exp|experimental|beta|thinking|reason|vision|code|coder|audio|tts|latest-\d)/i;

/** The model a feature uses on a provider when nobody pinned one. */
export function pickDefaultModel(provider: AiProviderId, tier: AiTier, live: AiModelInfo[] | null): string {
  const hints = AI_PROVIDERS[provider].hints[tier];
  if (!live?.length) return hints[0];
  const ids = new Set(live.map((m) => m.id));
  const hinted = hints.find((h) => ids.has(h));
  if (hinted) return hinted;
  const pattern = tier === "fast" ? FAST : SMART;
  const stable = live.filter((m) => !AVOID.test(m.id));
  const guess = stable.find((m) => pattern.test(m.id)) ?? stable[0] ?? live[0];
  return guess.id;
}
