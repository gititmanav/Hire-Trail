/**
 * BYOK key validation for POST /api/ai/keys/validate.
 *
 * Two strategies (catalog-driven):
 *   - "rest": a cheap GET against the provider's models/auth endpoint. Used for
 *     providers with a simple key-only REST auth (anthropic/openai/google/openrouter).
 *   - "gateway": a 1-token generate through the AI Gateway with the key supplied
 *     as byok. Works for any gateway provider (incl. Bedrock). Only available
 *     when AI_GATEWAY_API_KEY is set; otherwise we can't pre-validate and return
 *     ok:true optimistically (the real call surfaces a friendly error if wrong).
 *
 * Never throws — always resolves to a JSON-able result. Never persists anything.
 */
import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

import { env } from "../../config/env.js";
import type { AIProvider } from "../../models/AIProviderConfig.js";
import { getProvider } from "./catalog.js";

export interface ValidateResult {
  ok: boolean;
  reason?: string;
  modelTested?: string;
}

async function restValidate(provider: string, key: string): Promise<ValidateResult> {
  let url = "";
  const headers: Record<string, string> = {};
  if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/models";
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/models";
    headers["Authorization"] = `Bearer ${key}`;
  } else if (provider === "google") {
    // Header auth keeps the key out of URLs / proxy logs / referers.
    url = "https://generativelanguage.googleapis.com/v1beta/models";
    headers["x-goog-api-key"] = key;
  } else if (provider === "openrouter") {
    url = "https://openrouter.ai/api/v1/auth/key";
    headers["Authorization"] = `Bearer ${key}`;
  } else {
    return { ok: false, reason: "Unknown provider." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (r.status === 200) return { ok: true };
    if (r.status === 401 || r.status === 403) return { ok: false, reason: "Key was rejected by the provider." };
    if (r.status === 429) return { ok: false, reason: "Provider rate limit hit — try again in a moment." };
    return { ok: false, reason: `Provider returned ${r.status}.` };
  } catch (err) {
    const e = err as { name?: string };
    if (e?.name === "AbortError") return { ok: false, reason: "Validation timed out." };
    return { ok: false, reason: "Could not reach provider." };
  } finally {
    clearTimeout(timeout);
  }
}

async function gatewayValidate(provider: string, key: string, model?: string): Promise<ValidateResult> {
  const cat = getProvider(provider);
  // Validate the model the user actually picked — not a per-provider default that
  // may be unavailable in their account (e.g. a Bedrock acct without Claude 3.5).
  const modelId = (model && model.trim()) || cat.defaultFast;
  // Multi-field providers (Bedrock/Azure/Vertex) send a JSON credential object;
  // everyone else a single apiKey. Provider-agnostic: parse JSON if it looks like it.
  let credential: Record<string, unknown>;
  const trimmed = key.trim();
  if (trimmed.startsWith("{")) {
    try {
      credential = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: "Multi-field credentials must be valid JSON." };
    }
  } else {
    credential = { apiKey: key };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
    await generateText({
      model: gateway(modelId),
      prompt: "ping",
      maxOutputTokens: 1,
      abortSignal: controller.signal,
      providerOptions: { gateway: { byok: { [provider]: [credential] } } } as never,
    });
    return { ok: true, modelTested: modelId };
  } catch (err) {
    const e = err as { statusCode?: number; status?: number; message?: string };
    const status = e.statusCode ?? e.status;
    if (status === 401 || status === 403) return { ok: false, reason: "Key was rejected by the provider." };
    if (status === 402) return { ok: false, reason: "This account has no available credit." };
    if (status === 429) return { ok: false, reason: "Provider rate limit hit — try again in a moment." };
    return { ok: false, reason: (e.message?.slice(0, 140) || "Validation failed.").trim() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateProviderKey(provider: string, key: string, model?: string): Promise<ValidateResult> {
  const cat = getProvider(provider); // never undefined (derives for unknowns)

  if (env.AI_GATEWAY_API_KEY) {
    // The gateway is how every call actually runs, so validate the way we'll use it.
    return gatewayValidate(provider, key, model);
  }
  if (cat.validate === "rest") {
    return restValidate(provider, key);
  }
  // No gateway + no REST check available — accept; first real use will verify.
  return { ok: true, reason: "Stored without pre-validation (no AI Gateway configured)." };
}
