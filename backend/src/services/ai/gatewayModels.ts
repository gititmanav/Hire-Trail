/**
 * Live Vercel AI Gateway model catalog (public, no-auth endpoint).
 *
 * The gateway serves hundreds of models across 40+ providers and the set changes
 * over time, so we fetch it live and cache in-process rather than hardcoding.
 * `services/ai/catalog.ts` layers curated metadata (getKeyUrl, credential shape,
 * sensible defaults) on top of this for a robust, never-undefined catalog.
 *
 * Resilience: a 1h success TTL, a short negative TTL so a transient failure
 * doesn't hammer the endpoint, single-flight de-dup, and stale-on-error (keep the
 * last good list if a refresh fails). All callers degrade gracefully to [].
 */
const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const TTL_MS = 60 * 60 * 1000; // 1h
const ERR_TTL_MS = 60 * 1000; // back off ~1min after a failure

export interface GatewayModel {
  /** Gateway id, "provider/model" (also the call + pricing key). */
  id: string;
  provider: string;
  label: string;
  contextWindow?: number;
  pricing?: { input?: number; output?: number };
}

interface Cache { models: GatewayModel[]; at: number; ok: boolean; }
let cache: Cache | null = null;
let inflight: Promise<GatewayModel[]> | null = null;

function parse(data: unknown): GatewayModel[] {
  const arr = (data as { data?: unknown[] })?.data;
  if (!Array.isArray(arr)) return [];
  const out: GatewayModel[] = [];
  for (const raw of arr) {
    const m = raw as Record<string, unknown>;
    // Chat/completion models only — skip embeddings/image/etc.
    if (typeof m.type === "string" && m.type !== "language") continue;
    const id = String(m.id ?? "");
    const slash = id.indexOf("/");
    if (slash <= 0) continue;
    const pricing = m.pricing as { input?: unknown; output?: unknown } | undefined;
    out.push({
      id,
      provider: id.slice(0, slash),
      label: typeof m.name === "string" && m.name.trim() ? m.name : id,
      contextWindow: typeof m.context_window === "number" ? m.context_window : undefined,
      pricing: pricing
        ? { input: Number(pricing.input) || undefined, output: Number(pricing.output) || undefined }
        : undefined,
    });
  }
  return out;
}

async function fetchModels(): Promise<GatewayModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const r = await fetch(MODELS_URL, { signal: controller.signal });
    if (!r.ok) throw new Error(`gateway models returned ${r.status}`);
    const models = parse(await r.json());
    cache = { models, at: Date.now(), ok: true };
    return models;
  } catch (err) {
    console.warn("[ai] gateway model list fetch failed:", err instanceof Error ? err.message : err);
    // Keep the last good list (stale-on-error); negative-cache the timestamp.
    cache = { models: cache?.models ?? [], at: Date.now(), ok: false };
    return cache.models;
  } finally {
    clearTimeout(timer);
  }
}

/** Return the model list, refreshing if stale. Safe to call on every request
 *  (single-flight + cache). Never throws. */
export async function ensureGatewayModels(): Promise<GatewayModel[]> {
  const age = cache ? Date.now() - cache.at : Infinity;
  if (cache && cache.ok && age < TTL_MS) return cache.models;
  if (cache && !cache.ok && age < ERR_TTL_MS) return cache.models; // backing off
  if (!inflight) inflight = fetchModels().finally(() => { inflight = null; });
  return inflight;
}

/** Synchronous read of whatever's cached (may be []). For hot paths that can't await. */
export function getCachedModels(): GatewayModel[] {
  return cache?.models ?? [];
}

/** The distinct provider ids present in the live catalog. */
export function getDynamicProviders(): string[] {
  return [...new Set(getCachedModels().map((m) => m.provider))].sort();
}

export function modelsForProvider(provider: string): GatewayModel[] {
  return getCachedModels().filter((m) => m.provider === provider);
}
