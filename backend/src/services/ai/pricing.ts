/**
 * Static price table (USD per 1M tokens) used to estimate per-call cost for the
 * usage meter. Prices are approximate list prices and intentionally local so a
 * vendor price change never rewrites historical AiUsage rows — we snapshot the
 * estimate at write time.
 *
 * Keyed by gateway model id ("provider/model"). Lookups fall back to a
 * per-provider default, then a global default, so an unknown/new model still
 * gets a sane (non-zero) estimate rather than silently reading as free.
 */

interface Price {
  /** USD per 1,000,000 input tokens. */
  inputPerM: number;
  /** USD per 1,000,000 output tokens. */
  outputPerM: number;
}

const MODEL_PRICES: Record<string, Price> = {
  // Anthropic
  "anthropic/claude-haiku-4-5": { inputPerM: 1.0, outputPerM: 5.0 },
  "anthropic/claude-sonnet-4-6": { inputPerM: 3.0, outputPerM: 15.0 },
  "anthropic/claude-opus-4-8": { inputPerM: 15.0, outputPerM: 75.0 },
  // OpenAI
  "openai/gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "openai/gpt-4o": { inputPerM: 2.5, outputPerM: 10.0 },
  "openai/gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  // Google
  "google/gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5 },
  "google/gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10.0 },
  // Mistral
  "mistral/mistral-small-latest": { inputPerM: 0.2, outputPerM: 0.6 },
  "mistral/mistral-large-latest": { inputPerM: 2.0, outputPerM: 6.0 },
  // xAI
  "xai/grok-3-mini": { inputPerM: 0.3, outputPerM: 0.5 },
  "xai/grok-4": { inputPerM: 3.0, outputPerM: 15.0 },
  // Groq
  "groq/llama-3.3-70b-versatile": { inputPerM: 0.59, outputPerM: 0.79 },
  // DeepSeek
  "deepseek/deepseek-chat": { inputPerM: 0.27, outputPerM: 1.1 },
  "deepseek/deepseek-reasoner": { inputPerM: 0.55, outputPerM: 2.19 },
  // Perplexity
  "perplexity/sonar": { inputPerM: 1.0, outputPerM: 1.0 },
  "perplexity/sonar-pro": { inputPerM: 3.0, outputPerM: 15.0 },
  // Cohere
  "cohere/command-r": { inputPerM: 0.15, outputPerM: 0.6 },
  "cohere/command-r-plus": { inputPerM: 2.5, outputPerM: 10.0 },
};

/** Conservative per-provider fallbacks when an exact model id isn't listed. */
const PROVIDER_DEFAULT: Record<string, Price> = {
  anthropic: { inputPerM: 3.0, outputPerM: 15.0 },
  openai: { inputPerM: 2.5, outputPerM: 10.0 },
  google: { inputPerM: 0.3, outputPerM: 2.5 },
  bedrock: { inputPerM: 3.0, outputPerM: 15.0 },
  mistral: { inputPerM: 2.0, outputPerM: 6.0 },
  xai: { inputPerM: 3.0, outputPerM: 15.0 },
  groq: { inputPerM: 0.6, outputPerM: 0.8 },
  deepseek: { inputPerM: 0.3, outputPerM: 1.1 },
  openrouter: { inputPerM: 3.0, outputPerM: 15.0 },
  perplexity: { inputPerM: 1.0, outputPerM: 1.0 },
  cohere: { inputPerM: 2.5, outputPerM: 10.0 },
};

const GLOBAL_DEFAULT: Price = { inputPerM: 2.0, outputPerM: 8.0 };

function priceFor(model: string): Price {
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const provider = model.includes("/") ? model.split("/")[0] : model;
  return PROVIDER_DEFAULT[provider] ?? GLOBAL_DEFAULT;
}

/** Estimated USD cost for a single call. Rounded to 6 dp (sub-cent precision). */
export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = priceFor(model);
  const cost = (tokensIn / 1_000_000) * p.inputPerM + (tokensOut / 1_000_000) * p.outputPerM;
  return Math.round(cost * 1e6) / 1e6;
}
