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
import { getDynamicProviders, modelsForProvider } from "./gatewayModels.js";

export interface CatalogModel {
  /** Gateway id, e.g. "anthropic/claude-haiku-4-5". */
  id: string;
  label: string;
  capability: Capability;
}

/** How a BYOK credential is collected/stored for a provider:
 *   - "apiKey": a single secret string (most providers).
 *   - "fields": a few named fields (Bedrock: accessKeyId/secretAccessKey/region; Azure: apiKey/resourceName) → stored as a JSON object.
 *   - "json":   paste a raw JSON credential object (e.g. Vertex). */
export type CredentialFormat = "apiKey" | "fields" | "json";
export interface CredentialField { key: string; label: string; type: "text" | "password"; optional?: boolean; }

export interface CatalogProvider {
  /** Provider id / gateway prefix (curated or dynamic). */
  id: string;
  label: string;
  models: CatalogModel[];
  defaultFast: string;
  defaultSmart: string;
  /** True when the provider offers a usable free tier (surfaced in the UI). */
  freeTier: boolean;
  /** Where the user goes to mint a key ("" when unknown for a dynamic provider). */
  getKeyUrl: string;
  /** Legacy hint kept for back-compat: "single" string vs "aws"/multi-field blob. */
  keyKind: "single" | "aws";
  /** How POST /api/ai/keys/validate checks a key ("rest" only for the 4 direct providers). */
  validate: "rest" | "gateway";
  /** Whether this provider can ONLY run through the gateway (no direct SDK).
   *  Filled by getProvider() — optional on raw curated entries. */
  gatewayOnly?: boolean;
  /** Credential collection shape for the UI. Filled by getProvider(). */
  credentialFormat?: CredentialFormat;
  credentialFields?: CredentialField[];
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

/** Providers served by a direct SDK (no gateway needed). */
const DIRECT_PROVIDERS = new Set<string>(["anthropic", "openai", "google", "openrouter"]);

/** Multi-field / JSON credential shapes (everything else is a single apiKey). */
const CREDENTIAL_SHAPES: Record<string, { format: CredentialFormat; fields?: CredentialField[] }> = {
  bedrock: { format: "fields", fields: [
    { key: "accessKeyId", label: "Access Key ID", type: "text" },
    { key: "secretAccessKey", label: "Secret Access Key", type: "password" },
    { key: "region", label: "Region (e.g. us-east-1)", type: "text", optional: true },
  ] },
  azure: { format: "fields", fields: [
    { key: "apiKey", label: "API Key", type: "password" },
    { key: "resourceName", label: "Resource Name", type: "text" },
  ] },
  vertex: { format: "json" }, // paste {project, location, googleCredentials:{privateKey, clientEmail}}
};

/** Curated get-key URLs for dynamic providers we recognize (curated entries carry their own). */
const GET_KEY_URLS: Record<string, string> = {
  togetherai: "https://api.together.xyz/settings/api-keys",
  fireworks: "https://fireworks.ai/account/api-keys",
  cerebras: "https://cloud.cerebras.ai/",
  deepinfra: "https://deepinfra.com/dash/api_keys",
  novita: "https://novita.ai/settings/key-management",
  azure: "https://portal.azure.com/",
  vertex: "https://console.cloud.google.com/vertex-ai",
};

function titleCase(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The credential collection shape for a provider (curated keyKind respected). */
export function credentialShape(provider: string): { format: CredentialFormat; fields?: CredentialField[] } {
  if (CREDENTIAL_SHAPES[provider]) return CREDENTIAL_SHAPES[provider];
  const curated = CATALOG[provider as AIProvider];
  if (curated?.keyKind === "aws") return CREDENTIAL_SHAPES.bedrock;
  return { format: "apiKey" };
}

/** Resolve a provider to a fully-populated CatalogProvider. NEVER undefined:
 *  curated entry (merged with live models) → derived from the live catalog →
 *  a minimal fallback. This is what keeps the system from falling apart when a
 *  provider isn't in the curated set. */
export function getProvider(provider: string): CatalogProvider {
  const shape = credentialShape(provider);
  const liveModels = modelsForProvider(provider).map((m): CatalogModel => ({ id: m.id, label: m.label, capability: "smart" }));
  const curated = CATALOG[provider as AIProvider];

  if (curated) {
    const seen = new Set(curated.models.map((m) => m.id));
    const models = [...curated.models, ...liveModels.filter((m) => !seen.has(m.id))];
    return {
      ...curated,
      models,
      gatewayOnly: !DIRECT_PROVIDERS.has(provider),
      credentialFormat: shape.format,
      credentialFields: shape.fields,
    };
  }

  const first = liveModels[0]?.id ?? `${provider}/`;
  return {
    id: provider,
    label: titleCase(provider),
    models: liveModels,
    defaultFast: first,
    defaultSmart: first,
    freeTier: false,
    getKeyUrl: GET_KEY_URLS[provider] ?? "",
    keyKind: shape.format === "apiKey" ? "single" : "aws",
    validate: "gateway",
    gatewayOnly: true,
    credentialFormat: shape.format,
    credentialFields: shape.fields,
  };
}

/** Full catalog = curated providers (in order) ∪ live gateway providers. */
export function getCatalog(): CatalogProvider[] {
  const curatedOrder = AI_PROVIDERS as readonly string[];
  const all = [...new Set<string>([...curatedOrder, ...getDynamicProviders()])];
  all.sort((a, b) => {
    const ia = curatedOrder.indexOf(a);
    const ib = curatedOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return all.map(getProvider);
}

/** True when a provider is curated OR present in the live gateway catalog. */
export function isKnownProvider(provider: string): boolean {
  return Boolean(CATALOG[provider as AIProvider]) || getDynamicProviders().includes(provider);
}

/** Default gateway model id for a provider + capability, honoring a user override. */
export function defaultModelId(provider: string, capability: Capability, override?: string | null): string {
  const o = override?.trim();
  if (o) return o.includes("/") ? o : `${provider}/${o}`;
  const curated = CATALOG[provider as AIProvider];
  if (curated) return capability === "smart" ? curated.defaultSmart : curated.defaultFast;
  const live = modelsForProvider(provider);
  if (live.length) return live[0].id;
  return `${provider}/`; // surfaces a clear gateway error if truly unknown
}

/** Human label for a provider id (falls back to a title-cased id for unknowns). */
export function providerLabel(provider: string): string {
  return CATALOG[provider as AIProvider]?.label ?? titleCase(provider);
}

export { CATALOG };
