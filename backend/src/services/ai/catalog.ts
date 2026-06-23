/**
 * Provider catalog — single source of truth for the AI platform.
 *
 * Drives:
 *   - GET /api/ai/providers   (the {id,label,models[],freeTier,getKeyUrl} catalog)
 *   - default model selection per capability (fast / smart)
 *   - how a BYOK key is validated + forwarded to the gateway
 *
 * Model ids are stored in GATEWAY form ("provider/model"). When the gateway is
 * disabled we strip the "provider/" prefix and call the per-provider SDK with
 * the bare model id (see services/ai/index.ts).
 */
import type { Capability } from "./capability.js";
import { AI_PROVIDERS, type AIProvider } from "../../models/AIProviderConfig.js";

export interface CatalogModel {
  /** Gateway id, e.g. "anthropic/claude-haiku-4-5". */
  id: string;
  label: string;
  capability: Capability;
}

export interface CatalogProvider {
  id: AIProvider;
  label: string;
  models: CatalogModel[];
  defaultFast: string;
  defaultSmart: string;
  /** True when the provider offers a usable free tier (surfaced in the UI). */
  freeTier: boolean;
  /** Where the user goes to mint a key. */
  getKeyUrl: string;
  /** Shape of the stored secret. "single" = one API key string; "aws" = a JSON
   *  blob {accessKeyId, secretAccessKey, region} (Bedrock). */
  keyKind: "single" | "aws";
  /** How POST /api/ai/keys/validate checks a key:
   *   - "rest": cheap unauthenticated-ish GET against the provider's models API
   *   - "gateway": a 1-token generate through the gateway with the key as byok
   *     (used for providers without a simple key-check endpoint). */
  validate: "rest" | "gateway";
}

const CATALOG: Record<AIProvider, CatalogProvider> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5", capability: "fast" },
      { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", capability: "smart" },
      { id: "anthropic/claude-opus-4-8", label: "Claude Opus 4.8", capability: "smart" },
    ],
    defaultFast: "anthropic/claude-haiku-4-5",
    defaultSmart: "anthropic/claude-sonnet-4-6",
    freeTier: false,
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    keyKind: "single",
    validate: "rest",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini", capability: "fast" },
      { id: "openai/gpt-4o", label: "GPT-4o", capability: "smart" },
      { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", capability: "fast" },
    ],
    defaultFast: "openai/gpt-4o-mini",
    defaultSmart: "openai/gpt-4o",
    freeTier: false,
    getKeyUrl: "https://platform.openai.com/api-keys",
    keyKind: "single",
    validate: "rest",
  },
  google: {
    id: "google",
    label: "Google Gemini",
    models: [
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", capability: "fast" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", capability: "smart" },
    ],
    // Both capabilities map to Flash: Pro has no free quota so default-key users
    // would 429 immediately. Set a model override to use Pro on a paid key.
    defaultFast: "google/gemini-2.5-flash",
    defaultSmart: "google/gemini-2.5-flash",
    freeTier: true,
    getKeyUrl: "https://aistudio.google.com/apikey",
    keyKind: "single",
    validate: "rest",
  },
  bedrock: {
    id: "bedrock",
    label: "Amazon Bedrock",
    models: [
      { id: "bedrock/anthropic.claude-3-5-haiku-20241022-v1:0", label: "Claude 3.5 Haiku (Bedrock)", capability: "fast" },
      { id: "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet (Bedrock)", capability: "smart" },
    ],
    defaultFast: "bedrock/anthropic.claude-3-5-haiku-20241022-v1:0",
    defaultSmart: "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
    freeTier: false,
    getKeyUrl: "https://console.aws.amazon.com/bedrock/",
    keyKind: "aws",
    validate: "gateway",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    models: [
      { id: "mistral/mistral-small-latest", label: "Mistral Small", capability: "fast" },
      { id: "mistral/mistral-large-latest", label: "Mistral Large", capability: "smart" },
    ],
    defaultFast: "mistral/mistral-small-latest",
    defaultSmart: "mistral/mistral-large-latest",
    freeTier: true,
    getKeyUrl: "https://console.mistral.ai/api-keys/",
    keyKind: "single",
    validate: "gateway",
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    models: [
      { id: "xai/grok-3-mini", label: "Grok 3 Mini", capability: "fast" },
      { id: "xai/grok-4", label: "Grok 4", capability: "smart" },
    ],
    defaultFast: "xai/grok-3-mini",
    defaultSmart: "xai/grok-4",
    freeTier: false,
    getKeyUrl: "https://console.x.ai/",
    keyKind: "single",
    validate: "gateway",
  },
  groq: {
    id: "groq",
    label: "Groq",
    models: [
      { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", capability: "fast" },
      { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", capability: "smart" },
    ],
    defaultFast: "groq/llama-3.3-70b-versatile",
    defaultSmart: "groq/llama-3.3-70b-versatile",
    freeTier: true,
    getKeyUrl: "https://console.groq.com/keys",
    keyKind: "single",
    validate: "gateway",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", capability: "fast" },
      { id: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner", capability: "smart" },
    ],
    defaultFast: "deepseek/deepseek-chat",
    defaultSmart: "deepseek/deepseek-chat",
    freeTier: false,
    getKeyUrl: "https://platform.deepseek.com/api_keys",
    keyKind: "single",
    validate: "gateway",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      { id: "openrouter/anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5 (OpenRouter)", capability: "fast" },
      { id: "openrouter/anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (OpenRouter)", capability: "smart" },
    ],
    defaultFast: "openrouter/anthropic/claude-haiku-4.5",
    defaultSmart: "openrouter/anthropic/claude-sonnet-4.6",
    freeTier: true,
    getKeyUrl: "https://openrouter.ai/keys",
    keyKind: "single",
    validate: "rest",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    models: [
      { id: "perplexity/sonar", label: "Sonar", capability: "fast" },
      { id: "perplexity/sonar-pro", label: "Sonar Pro", capability: "smart" },
    ],
    defaultFast: "perplexity/sonar",
    defaultSmart: "perplexity/sonar-pro",
    freeTier: false,
    getKeyUrl: "https://www.perplexity.ai/settings/api",
    keyKind: "single",
    validate: "gateway",
  },
  cohere: {
    id: "cohere",
    label: "Cohere",
    models: [
      { id: "cohere/command-r", label: "Command R", capability: "fast" },
      { id: "cohere/command-r-plus", label: "Command R+", capability: "smart" },
    ],
    defaultFast: "cohere/command-r",
    defaultSmart: "cohere/command-r-plus",
    freeTier: true,
    getKeyUrl: "https://dashboard.cohere.com/api-keys",
    keyKind: "single",
    validate: "gateway",
  },
};

export function getCatalog(): CatalogProvider[] {
  return AI_PROVIDERS.map((p) => CATALOG[p]);
}

export function getProvider(provider: AIProvider): CatalogProvider {
  return CATALOG[provider];
}

/** Default gateway model id for a provider + capability, honoring a user override. */
export function defaultModelId(provider: AIProvider, capability: Capability, override?: string | null): string {
  const o = override?.trim();
  if (o) return o.includes("/") ? o : `${provider}/${o}`;
  const cat = CATALOG[provider];
  return capability === "smart" ? cat.defaultSmart : cat.defaultFast;
}

/** Human label for a provider id (falls back to the raw id for unknown ones). */
export function providerLabel(provider: string): string {
  return (CATALOG as Record<string, CatalogProvider | undefined>)[provider]?.label ?? provider;
}

export { CATALOG };
