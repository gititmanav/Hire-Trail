/**
 * What a call costs — USD per million tokens, never "free" by accident.
 *
 * Lookup order:
 *   1. OpenRouter's public model catalog (no key needed): live prices for
 *      hundreds of models across every provider we support, cached 6 h.
 *      Direct-provider ids are normalized onto it (claude-haiku-4-5-20251001
 *      → anthropic/claude-haiku-4.5); several matches → the most expensive.
 *   2. The curated table below (checked 2026-10-05 against vendor pages).
 *   3. The provider's most expensive known tier — an unknown model is priced
 *      HIGH, so budgets can only overcount (Sora finding F3).
 *
 * The estimate is stamped on the ledger row at write time; a later price
 * change never rewrites history.
 */
import type { AiProviderId } from "./providerIds.js";
import { AI_PROVIDERS } from "./providers.js";

export interface Price {
  inPerM: number;
  outPerM: number;
  source: "live" | "table" | "fallback";
}

const CURATED: Record<string, { inPerM: number; outPerM: number }> = {
  // Anthropic
  "claude-haiku-4-5": { inPerM: 1, outPerM: 5 },
  "claude-haiku-4-5-20251001": { inPerM: 1, outPerM: 5 },
  "claude-sonnet-5-5": { inPerM: 2, outPerM: 10 },
  "claude-opus-5-5": { inPerM: 4, outPerM: 20 },
  "claude-fable-5-1": { inPerM: 10, outPerM: 50 },
  // Google (3.7/3.8 Flash list price doubles on 2027-01-01)
  "gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5 },
  "gemini-3.5-flash-lite": { inPerM: 0.3, outPerM: 2.5 },
  "gemini-3.7-flash": { inPerM: 0.75, outPerM: 3.75 },
  "gemini-3.8-flash": { inPerM: 0.75, outPerM: 3.75 },
  "gemini-3.1-pro-preview": { inPerM: 2, outPerM: 12 },
  // OpenAI
  "gpt-5-nano": { inPerM: 0.05, outPerM: 0.4 },
  "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6 },
  "gpt-5-mini": { inPerM: 0.25, outPerM: 2 },
  "gpt-5": { inPerM: 1.25, outPerM: 10 },
  // xAI
  "grok-4.3": { inPerM: 1.25, outPerM: 2.5 },
  "grok-4.5": { inPerM: 2, outPerM: 6 },
  "grok-4.6": { inPerM: 2, outPerM: 6 },
  "grok-4.7": { inPerM: 2, outPerM: 6 },
  // DeepSeek (peak-hour rates — the higher of their two)
  "deepseek-flash": { inPerM: 0.3, outPerM: 1.2 },
  "deepseek-v4-pro": { inPerM: 1.32, outPerM: 3.96 },
  // Groq
  "openai/gpt-oss-20b": { inPerM: 0.075, outPerM: 0.3 },
  "openai/gpt-oss-120b": { inPerM: 0.15, outPerM: 0.6 },
  "llama-3.3-70b-versatile": { inPerM: 0.59, outPerM: 0.79 },
  "llama-3.1-8b-instant": { inPerM: 0.05, outPerM: 0.08 },
};

/** Worst known tier per provider — the price of an unrecognized model. */
const FALLBACK: Record<AiProviderId, { inPerM: number; outPerM: number }> = {
  anthropic: { inPerM: 10, outPerM: 50 },
  google: { inPerM: 2, outPerM: 12 },
  openai: { inPerM: 10, outPerM: 50 },
  xai: { inPerM: 2, outPerM: 6 },
  deepseek: { inPerM: 1.32, outPerM: 3.96 },
  mistral: { inPerM: 2, outPerM: 6 },
  groq: { inPerM: 0.59, outPerM: 0.79 },
  openrouter: { inPerM: 10, outPerM: 50 },
};

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

let catalog: Map<string, { inPerM: number; outPerM: number }> | null = null;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;

async function refreshCatalog(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data?: { id?: string; pricing?: { prompt?: string; completion?: string } }[] };
    const next = new Map<string, { inPerM: number; outPerM: number }>();
    for (const m of body.data ?? []) {
      const inP = Number(m.pricing?.prompt);
      const outP = Number(m.pricing?.completion);
      if (!m.id || !Number.isFinite(inP) || !Number.isFinite(outP) || inP < 0 || outP < 0) continue;
      next.set(m.id, { inPerM: inP * 1_000_000, outPerM: outP * 1_000_000 });
    }
    if (next.size) catalog = next;
    fetchedAt = Date.now();
  } catch (err) {
    // Keep the last good catalog; try again in a few minutes.
    fetchedAt = Date.now() - TTL_MS + RETRY_MS;
    console.warn("[ai-pricing] catalog refresh failed:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}

/** Warm the live catalog (non-blocking callers may skip awaiting). */
export function ensurePriceCatalog(): Promise<void> {
  if (catalog && Date.now() - fetchedAt < TTL_MS) return Promise.resolve();
  if (!inflight) inflight = refreshCatalog().finally(() => { inflight = null; });
  return inflight;
}

/** Ways a direct-provider id might be spelled in the OpenRouter catalog. */
function candidates(provider: AiProviderId, model: string): string[] {
  const prefix = AI_PROVIDERS[provider].openrouterPrefix;
  if (provider === "openrouter") return [model, model.replace(/:free$/, "")];
  const base = model
    .replace(/-\d{8}$/, "")           // dated snapshot suffix
    .replace(/-latest$/, "")
    .replace(/(\d)-(\d)(?=$|-)/g, "$1.$2"); // claude-haiku-4-5 → claude-haiku-4.5
  const ids = prefix ? [`${prefix}/${model}`, `${prefix}/${base}`] : [model];
  return [...new Set(ids)];
}

function fromCatalog(provider: AiProviderId, model: string): { inPerM: number; outPerM: number } | null {
  if (!catalog) return null;
  for (const id of candidates(provider, model)) {
    const hit = catalog.get(id);
    if (hit) return hit;
  }
  // Family match ("mistralai/mistral-small" → every dated small) — most expensive wins.
  let best: { inPerM: number; outPerM: number } | null = null;
  for (const id of candidates(provider, model)) {
    if (id.length < 8) continue;
    for (const [k, v] of catalog) {
      if (!k.startsWith(id) || k.endsWith(":batch") || k.endsWith(":free")) continue;
      if (!best || v.inPerM + v.outPerM > best.inPerM + best.outPerM) best = v;
    }
    if (best) return best;
  }
  return null;
}

export function priceFor(provider: AiProviderId, model: string): Price {
  const live = fromCatalog(provider, model);
  if (live) return { ...live, source: "live" };
  const table = CURATED[model];
  if (table) return { ...table, source: "table" };
  return { ...FALLBACK[provider], source: "fallback" };
}

/** USD for a call, rounded to 6 dp. */
export function costUsd(provider: AiProviderId, model: string, tokensIn: number, tokensOut: number): number {
  const p = priceFor(provider, model);
  const cost = (tokensIn / 1_000_000) * p.inPerM + (tokensOut / 1_000_000) * p.outPerM;
  return Math.round(cost * 1e6) / 1e6;
}

/** Rough token count for text we're about to send (~3.5 chars per token,
 *  rounded up — reservations should err high). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
