/** The providers HireTrail talks to directly — each has its own adapter in
 *  services/ai/providers.ts. Kept dependency-free so models can import it.
 *  Adding one = an id here + an adapter entry (and a mark on the frontend). */
export const AI_PROVIDER_IDS = [
  "google",
  "anthropic",
  "openai",
  "xai",
  "deepseek",
  "mistral",
  "groq",
  "openrouter",
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export function isAiProviderId(v: unknown): v is AiProviderId {
  return typeof v === "string" && (AI_PROVIDER_IDS as readonly string[]).includes(v);
}

/** The three ways a feature can be paid for, plus Off. */
export const AI_LANES = ["included", "byok", "assistant", "off"] as const;
export type AiLane = (typeof AI_LANES)[number];

export function isAiLane(v: unknown): v is AiLane {
  return typeof v === "string" && (AI_LANES as readonly string[]).includes(v);
}
