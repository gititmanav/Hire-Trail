/**
 * AI model resolver — the platform's entry point (task 1).
 *
 * `resolveAi(userId, capability)` returns a fully-configured `LanguageModel`
 * plus the `providerOptions` to spread into the `generateObject`/`generateText`
 * call. Callers should NOT call this directly — go through services/ai/run.ts,
 * which layers caching, retry, metering, and quota on top.
 *
 * Routing:
 *   - When `AI_GATEWAY_API_KEY` is set, EVERY call goes through the Vercel AI
 *     Gateway as `provider/model`. BYOK keys (user or admin default) are
 *     forwarded per-request via `providerOptions.gateway.byok`. With no byok,
 *     the gateway bills Vercel system credits.
 *   - When the gateway key is absent, we fall back to the per-provider SDK for
 *     the four legacy providers (anthropic/openai/google/openrouter) so local
 *     dev keeps working. Other providers require the gateway.
 *
 * Resolution order (per spec):
 *   1. user's single ACTIVE BYOK key            → billed to user (byok)
 *   2. admin default (only if ai_enabled):
 *        a. gateway system credits, or
 *        b. admin default provider key (byok), or
 *        c. legacy env provider key
 *   3. otherwise → clear "bring your own key" error
 */
import { createGateway } from "@ai-sdk/gateway";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import mongoose from "mongoose";

import { AIProviderConfig, type AIProvider } from "../../models/AIProviderConfig.js";
import { decrypt } from "../../utils/encryption.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import type { Capability } from "./capability.js";
import { defaultModelId, getProvider } from "./catalog.js";
import { getAdminAiConfig } from "./adminConfig.js";

export type { Capability } from "./capability.js";

/** Credential kind, used for gateway spend attribution + error copy. */
export type CredentialType = "byok" | "system";

export interface ResolvedAi {
  model: LanguageModel;
  /** Passed as generate*({ providerOptions }). Undefined for the direct SDK. */
  providerOptions?: ProviderOptions;
  provider: AIProvider;
  /** Gateway-form id ("provider/model") — also the pricing/usage key. */
  modelId: string;
  /** True when billed to the user's own key. */
  byok: boolean;
  credentialType: CredentialType;
  kind: "gateway" | "direct";
  userId: string;
  /** Monthly token cap when using the admin default key (0 = unlimited / N/A). */
  monthlyTokenLimit: number;
}

/** Providers we can serve WITHOUT the gateway (have a direct AI SDK). */
const DIRECT_SDK_PROVIDERS: AIProvider[] = ["anthropic", "openai", "google", "openrouter"];

/** Env default-key preference order for the legacy fallback path. */
const ENV_FALLBACK_ORDER: AIProvider[] = ["google", "anthropic", "openai", "openrouter"];

function gatewayEnabled(): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY);
}

let _gateway: ReturnType<typeof createGateway> | null = null;
function getGateway() {
  if (!_gateway) _gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
  return _gateway;
}

function envKeyFor(provider: AIProvider): string {
  switch (provider) {
    case "anthropic": return env.ANTHROPIC_API_KEY;
    case "openai": return env.OPENAI_API_KEY;
    case "google": return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openrouter": return env.OPENROUTER_API_KEY;
    default: return "";
  }
}

/** Build the gateway byok credential object for a stored secret. */
function byokCredential(provider: AIProvider, rawSecret: string): Record<string, unknown> {
  if (getProvider(provider).keyKind === "aws") {
    // Bedrock: secret is a JSON blob {accessKeyId, secretAccessKey, region, ...}.
    try {
      const parsed = JSON.parse(rawSecret);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* fall through to apiKey form */
    }
  }
  return { apiKey: rawSecret };
}

/** Bare model id for the direct SDK (strip the leading "provider/"). */
function bareModelId(gatewayId: string): string {
  const i = gatewayId.indexOf("/");
  return i === -1 ? gatewayId : gatewayId.slice(i + 1);
}

/** Instantiate a model via the per-provider SDK (no gateway). */
function directModel(provider: AIProvider, apiKey: string, gatewayModelId: string): LanguageModel {
  const modelId = bareModelId(gatewayModelId);
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey })(modelId);
    case "openai": return createOpenAI({ apiKey })(modelId);
    case "google": return createGoogleGenerativeAI({ apiKey })(modelId);
    case "openrouter": return createOpenRouter({ apiKey }).chat(modelId);
    default:
      throw new AppError(
        `Provider "${provider}" requires the AI Gateway. Ask an admin to configure AI_GATEWAY_API_KEY.`,
        503,
      );
  }
}

interface BuildOpts {
  provider: AIProvider;
  capability: Capability;
  modelOverride?: string | null;
  /** Raw provider secret to forward as byok; omit for gateway system credits. */
  secret?: string;
  byok: boolean;
  credentialType: CredentialType;
  userId: string;
  monthlyTokenLimit: number;
}

/** Assemble a ResolvedAi for a chosen provider/credential, gateway or direct. */
function build(opts: BuildOpts): ResolvedAi {
  const modelId = defaultModelId(opts.provider, opts.capability, opts.modelOverride);

  if (gatewayEnabled()) {
    const gw: Record<string, unknown> = { user: opts.userId };
    if (opts.secret) {
      gw.byok = { [opts.provider]: [byokCredential(opts.provider, opts.secret)] };
    }
    return {
      model: getGateway()(modelId),
      // byok credentials are dynamic (per-provider shapes), so the structured
      // value can't be statically proven JSON — cast to the SDK's option type.
      providerOptions: { gateway: gw } as ProviderOptions,
      provider: opts.provider,
      modelId,
      byok: opts.byok,
      credentialType: opts.secret ? "byok" : opts.credentialType,
      kind: "gateway",
      userId: opts.userId,
      monthlyTokenLimit: opts.monthlyTokenLimit,
    };
  }

  // Direct SDK fallback needs an actual key.
  if (!opts.secret) {
    throw new AppError(
      "No AI Gateway configured and no provider key available. Set AI_GATEWAY_API_KEY or add a key in Settings → AI.",
      503,
    );
  }
  return {
    model: directModel(opts.provider, opts.secret, modelId),
    provider: opts.provider,
    modelId,
    byok: opts.byok,
    credentialType: opts.credentialType,
    kind: "direct",
    userId: opts.userId,
    monthlyTokenLimit: opts.monthlyTokenLimit,
  };
}

const BYOK_REQUIRED_MSG =
  "AI is in bring-your-own-key mode. Add your own provider key in Settings → AI Providers to use AI features.";

export async function resolveAi(
  userId: string | mongoose.Types.ObjectId,
  capability: Capability,
): Promise<ResolvedAi> {
  const uid = userId.toString();

  // 1. User's single active BYOK key (across all providers).
  const active = await AIProviderConfig.findOne({ userId, isActive: true }).lean();
  if (active) {
    try {
      const secret = decrypt(active.encryptedKey);
      return build({
        provider: active.provider,
        capability,
        modelOverride: active.modelOverride,
        secret,
        byok: true,
        credentialType: "byok",
        userId: uid,
        monthlyTokenLimit: 0,
      });
    } catch (err) {
      // Decryption failed (rotated ENCRYPTION_KEY) — fall through to default.
      console.error(`[ai] decrypt failed for user ${uid} active key:`, err);
    }
  }

  // 2. Admin default — only when AI is globally enabled.
  const admin = await getAdminAiConfig();
  if (admin.enabled) {
    // 2a. Gateway system credits.
    if (admin.usesGatewayCredits && gatewayEnabled()) {
      const provider = admin.defaultProvider || "google";
      return build({
        provider,
        capability,
        modelOverride: admin.defaultModel,
        byok: false,
        credentialType: "system",
        userId: uid,
        monthlyTokenLimit: admin.monthlyTokenLimit,
      });
    }
    // 2b. Admin default provider key (byok credential, billed to the admin).
    if (admin.defaultKey && admin.defaultProvider) {
      return build({
        provider: admin.defaultProvider,
        capability,
        modelOverride: admin.defaultModel,
        secret: admin.defaultKey,
        byok: false,
        credentialType: "byok",
        userId: uid,
        monthlyTokenLimit: admin.monthlyTokenLimit,
      });
    }
    // 2c. Legacy env provider keys.
    for (const provider of ENV_FALLBACK_ORDER) {
      const key = envKeyFor(provider);
      if (key) {
        return build({
          provider,
          capability,
          secret: key,
          byok: false,
          credentialType: "byok",
          userId: uid,
          monthlyTokenLimit: admin.monthlyTokenLimit,
        });
      }
    }
    // Enabled but nothing configured.
    throw new AppError(
      "AI is enabled but no default key is configured. An admin must set a default key in Admin → AI, or add your own in Settings → AI Providers.",
      503,
    );
  }

  // 3. AI disabled at the platform level → user must BYOK.
  throw new AppError(BYOK_REQUIRED_MSG, 403);
}

/** Lightweight status for GET /api/ai/status. */
export async function getAiStatus(
  userId: string | mongoose.Types.ObjectId,
): Promise<{ hasActiveKey: boolean; mode: "byok" | "default" | "disabled" }> {
  const hasActiveKey = Boolean(await AIProviderConfig.exists({ userId, isActive: true }));
  if (hasActiveKey) return { hasActiveKey: true, mode: "byok" };
  const admin = await getAdminAiConfig();
  if (!admin.enabled) return { hasActiveKey: false, mode: "disabled" };
  const hasDefault =
    (admin.usesGatewayCredits && gatewayEnabled()) ||
    Boolean(admin.defaultKey && admin.defaultProvider) ||
    ENV_FALLBACK_ORDER.some((p) => envKeyFor(p));
  return { hasActiveKey: false, mode: hasDefault ? "default" : "disabled" };
}

export { gatewayEnabled };
