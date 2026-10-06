/**
 * The provider adapters — HireTrail's own gateway, one entry per provider.
 *
 * Each provider gives the gateway exactly three things:
 *   - `model(key, id)`   an AI SDK LanguageModel (the SDK normalizes calls,
 *                        structured output, usage and errors across vendors)
 *   - `listModels(key)`  the live catalog this key can use, from the
 *                        provider's own API (never a hardcoded list — ids
 *                        move monthly)
 *   - `validate(key)`    a cheap liveness/auth probe for save-time testing
 *
 * Plus the human facts the UI shows (label, key hint, where to get a key).
 * Nothing outside services/ai imports a provider SDK.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import type { AiProviderId } from "./providerIds.js";
import type { AiErrorCode } from "./errors.js";

export interface AiModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
}

export interface AiProviderDef {
  id: AiProviderId;
  label: string;
  /** What a key looks like — the input placeholder. */
  keyHint: string;
  /** Catches an obviously wrong paste; the live probe is the real check. */
  keyPattern: RegExp;
  /** Where the user creates a key. Shown as a link, never fetched. */
  keysUrl: string;
  /** One line for the picker: who it suits, what it costs. */
  blurb: string;
  /** Offers a usable free tier (Google AI Studio). */
  hasFreeTier: boolean;
  /** Prefix of this provider's models in OpenRouter's public catalog (pricing). */
  openrouterPrefix: string;
  /** Curated model hints per tier, best first. Only used when present in the
   *  key's live list; otherwise a heuristic picks (models.ts). */
  hints: { fast: string[]; smart: string[] };
  model(key: string, modelId: string): LanguageModel;
  listModels(key: string, signal?: AbortSignal): Promise<AiModelInfo[]>;
}

/** Thrown by listModels/validate with a normalized code. */
export class AiProviderCallError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: controller.signal });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new AiProviderCallError(name === "AbortError" ? "timeout" : "provider_down", "Couldn't reach the provider.");
  } finally {
    clearTimeout(timer);
  }
  if (res.ok) return res.json();
  const body = (await res.text().catch(() => "")).slice(0, 300).toLowerCase();
  if (res.status === 401 || res.status === 403) throw new AiProviderCallError("auth", "The provider rejected this key.");
  if (res.status === 400 && /api[ _-]?key|invalid/.test(body)) throw new AiProviderCallError("auth", "The provider rejected this key.");
  if (res.status === 402 || /insufficient_quota|credit|billing|balance/.test(body)) {
    throw new AiProviderCallError("quota", "This account has no credit left with the provider.");
  }
  if (res.status === 429) throw new AiProviderCallError("rate_limit", "The provider is rate-limiting this key right now.");
  if (res.status >= 500) throw new AiProviderCallError("provider_down", "The provider didn't answer.");
  throw new AiProviderCallError("bad_request", `The provider answered ${res.status}.`);
}

/** OpenAI-style `{ data: [{ id }] }` lists. */
function idList(data: unknown, keep: (id: string) => boolean): AiModelInfo[] {
  const rows = (data as { data?: { id?: string; name?: string; display_name?: string; context_window?: number }[] })?.data ?? [];
  return rows
    .filter((m): m is { id: string } & typeof m => typeof m.id === "string" && keep(m.id))
    .map((m) => ({ id: m.id, label: m.display_name || m.name || m.id, contextWindow: m.context_window }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Not chat models: embeddings, audio, images, moderation, and so on. */
const NON_CHAT = /(embed|whisper|tts|transcri|speech|audio|realtime|dall-e|image|imagine|video|moderation|guard|ocr|search-preview|omni-moderation|davinci|babbage|computer-use|sora)/i;

export const AI_PROVIDERS: Record<AiProviderId, AiProviderDef> = {
  google: {
    id: "google",
    label: "Google Gemini",
    keyHint: "AIza…",
    keyPattern: /^AIza[0-9A-Za-z_-]{30,}$/,
    keysUrl: "https://aistudio.google.com/apikey",
    blurb: "Free to start in Google AI Studio — no card needed. Paid keys keep your data out of Google's training.",
    hasFreeTier: true,
    openrouterPrefix: "google",
    hints: {
      fast: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"],
      smart: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-flash-latest"],
    },
    model: (key, id) => createGoogleGenerativeAI({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = (await getJson(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        { "x-goog-api-key": key },
        signal,
      )) as { models?: { name?: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[] };
      return (data.models ?? [])
        .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent") && !NON_CHAT.test(m.name))
        .map((m) => ({ id: m.name!.replace(/^models\//, ""), label: m.displayName || m.name!, contextWindow: m.inputTokenLimit }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    keyHint: "sk-ant-…",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    keysUrl: "https://console.anthropic.com/settings/keys",
    blurb: "Claude models. Strong writing and careful rewrites; pay as you go.",
    hasFreeTier: false,
    openrouterPrefix: "anthropic",
    hints: {
      fast: ["claude-haiku-4-5", "claude-haiku-4-5-20251001"],
      smart: ["claude-sonnet-5-5", "claude-sonnet-5", "claude-haiku-4-5"],
    },
    model: (key, id) => createAnthropic({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = await getJson(
        "https://api.anthropic.com/v1/models?limit=1000",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal,
      );
      return idList(data, (id) => id.startsWith("claude"));
    },
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keyHint: "sk-…",
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    keysUrl: "https://platform.openai.com/api-keys",
    blurb: "GPT models. Pay as you go; billing must be set up on the account.",
    hasFreeTier: false,
    openrouterPrefix: "openai",
    hints: {
      fast: ["gpt-5-nano", "gpt-5-mini", "gpt-4o-mini"],
      smart: ["gpt-5-mini", "gpt-5", "gpt-4.1"],
    },
    model: (key, id) => createOpenAI({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }, signal);
      return idList(data, (id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !NON_CHAT.test(id));
    },
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    keyHint: "xai-…",
    keyPattern: /^xai-[A-Za-z0-9_-]{20,}$/,
    keysUrl: "https://console.x.ai/",
    blurb: "Grok models from xAI. Pay as you go.",
    hasFreeTier: false,
    openrouterPrefix: "x-ai",
    hints: {
      fast: ["grok-4.3", "grok-4.20-0309-non-reasoning"],
      smart: ["grok-4.7", "grok-4.6", "grok-4.5", "grok-4.3"],
    },
    model: (key, id) => createXai({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = await getJson("https://api.x.ai/v1/models", { Authorization: `Bearer ${key}` }, signal);
      return idList(data, (id) => id.startsWith("grok") && !NON_CHAT.test(id));
    },
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    keyHint: "sk-…",
    keyPattern: /^sk-[A-Za-z0-9]{20,}$/,
    keysUrl: "https://platform.deepseek.com/api_keys",
    blurb: "Very low prices for capable models. Pay as you go.",
    hasFreeTier: false,
    openrouterPrefix: "deepseek",
    hints: {
      fast: ["deepseek-flash", "deepseek-chat"],
      smart: ["deepseek-v4-pro", "deepseek-flash", "deepseek-chat"],
    },
    model: (key, id) => createDeepSeek({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = await getJson("https://api.deepseek.com/models", { Authorization: `Bearer ${key}` }, signal);
      return idList(data, (id) => id.startsWith("deepseek"));
    },
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    keyHint: "Your Mistral API key",
    keyPattern: /^[A-Za-z0-9]{24,}$/,
    keysUrl: "https://console.mistral.ai/api-keys/",
    blurb: "European models with a free experiment plan and low prices.",
    hasFreeTier: true,
    openrouterPrefix: "mistralai",
    hints: {
      fast: ["mistral-small-latest"],
      smart: ["mistral-medium-latest", "mistral-large-latest", "mistral-small-latest"],
    },
    model: (key, id) => createMistral({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = (await getJson("https://api.mistral.ai/v1/models", { Authorization: `Bearer ${key}` }, signal)) as {
        data?: { id?: string; name?: string; capabilities?: { completion_chat?: boolean }; max_context_length?: number }[];
      };
      return (data.data ?? [])
        .filter((m) => m.id && m.capabilities?.completion_chat !== false && !NON_CHAT.test(m.id))
        .map((m) => ({ id: m.id!, label: m.name || m.id!, contextWindow: m.max_context_length }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
  },
  groq: {
    id: "groq",
    label: "Groq",
    keyHint: "gsk_…",
    keyPattern: /^gsk_[A-Za-z0-9]{20,}$/,
    keysUrl: "https://console.groq.com/keys",
    blurb: "Open models served extremely fast, with a free tier.",
    hasFreeTier: true,
    openrouterPrefix: "",
    hints: {
      fast: ["openai/gpt-oss-20b", "llama-3.1-8b-instant"],
      smart: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
    },
    model: (key, id) => createGroq({ apiKey: key })(id),
    async listModels(key, signal) {
      const data = await getJson("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${key}` }, signal);
      return idList(data, (id) => !NON_CHAT.test(id));
    },
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyHint: "sk-or-…",
    keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    keysUrl: "https://openrouter.ai/keys",
    blurb: "One key for hundreds of models from many providers.",
    hasFreeTier: true,
    openrouterPrefix: "*",
    hints: {
      fast: ["google/gemini-3.1-flash-lite", "openai/gpt-5-nano", "deepseek/deepseek-v4.1-flash"],
      smart: ["google/gemini-3.8-flash", "anthropic/claude-haiku-4.5", "openai/gpt-5-mini"],
    },
    model: (key, id) => createOpenRouter({ apiKey: key }).chat(id),
    async listModels(key, signal) {
      // The key endpoint is the auth probe; the catalog itself is public.
      await getJson("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${key}` }, signal);
      const data = (await getJson("https://openrouter.ai/api/v1/models", {}, signal)) as {
        data?: { id?: string; name?: string; context_length?: number; architecture?: { output_modalities?: string[] } }[];
      };
      return (data.data ?? [])
        .filter((m) => m.id && !m.id.endsWith(":batch") && (m.architecture?.output_modalities ?? ["text"]).includes("text"))
        .map((m) => ({ id: m.id!, label: m.name || m.id!, contextWindow: m.context_length }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
  },
};

export function providerDef(id: AiProviderId): AiProviderDef {
  return AI_PROVIDERS[id];
}

/** The public facts the UI needs about every provider (no functions). */
export function publicProviders() {
  return Object.values(AI_PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    keyHint: p.keyHint,
    keysUrl: p.keysUrl,
    blurb: p.blurb,
    hasFreeTier: p.hasFreeTier,
  }));
}
