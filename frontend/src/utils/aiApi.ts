/**
 * The AI layer's client contract (backend: routes/ai.ts, routes/admin/ai.ts).
 *
 * Lanes — where a feature runs:
 *   included  — HireTrail's own key, within the person's monthly allowance
 *   byok      — "My key": one of the person's own provider keys
 *   assistant — the person's AI assistant (Claude Code and others, over MCP)
 *   off       — not run at all
 *
 * Errors from the AI layer carry `code: "ai_<reason>"`; the copy is already
 * written for a person — show `error`, act on `code`.
 */
import { api } from "./api.ts";

export type AiLane = "included" | "byok" | "assistant" | "off";
export type AiProviderId = "google" | "anthropic" | "openai" | "xai" | "deepseek" | "mistral" | "groq" | "openrouter";
export type AiLock = "admin_feature" | "admin_user" | "map_off" | null;

export const LANE_LABEL: Record<AiLane, string> = {
  included: "Included",
  byok: "My key",
  assistant: "My assistant",
  off: "Off",
};

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  keyHint: string;
  keysUrl: string;
  blurb: string;
  hasFreeTier: boolean;
}

export interface AiKey {
  id: string;
  owner: "platform" | "user";
  provider: AiProviderId;
  providerLabel: string;
  name: string;
  last4: string;
  freeTier: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface AiActivity {
  calls7d: number;
  failures7d: number;
  lastAt: string | null;
}

export interface AiFeatureInfo {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  tier: "fast" | "smart";
  lanes: AiLane[];
  defaultLane: AiLane;
  background: boolean;
  dataClass: "posting" | "resume" | "email";
  offMeans: string | null;
}

/** A feature on the person's map. */
export interface AiMapFeature extends AiFeatureInfo {
  lane: AiLane | null;
  choosable: AiLane[];
  lock: AiLock;
  refusal: { code: string; message: string } | null;
  /** The person moved it themselves ("Back to default" undoes that). */
  userChoice: boolean;
  keyId: string | null;
  pinnedKey: boolean;
  model: string | null;
  pinnedModel: boolean;
  provider: AiProviderId | null;
  providerLabel: string | null;
  activity: AiActivity;
}

export interface AiUsageSummary {
  period: string;
  resetsAt: string;
  included: { spentUsd: number; allowanceUsd: number; capUsd: number };
  byFeature: { feature: string; calls: number; failures: number; tokens: number; costUsd: number; lane: Record<string, number> }[];
  totals: { calls: number; tokens: number; costUsd: number; byokCostUsd: number };
}

export interface UserAiMap {
  policy: {
    aiEnabled: boolean;
    pauseMessage: string;
    userMapEnabled: boolean;
    lanes: { included: boolean; byok: boolean; assistant: boolean };
    freeTierKeysForEmail: boolean;
    /** Assistant connections (MCP) allowed at all. */
    mcpEnabled: boolean;
  };
  providers: AiProviderInfo[];
  keys: AiKey[];
  defaultKeyId: string | null;
  included: { available: boolean; provider: AiProviderId | null; providerLabel: string | null };
  assistant: { connected: boolean; lastUsedAt: string | null; client: string | null };
  features: AiMapFeature[];
  usage: AiUsageSummary;
}

export interface AiModelInfo {
  id: string;
  label: string;
}

export interface AiKeyResult {
  key: AiKey;
  /** Set when the key was saved but couldn't be checked yet. */
  note: string | null;
}

export interface AiJob {
  id: string;
  feature: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "waiting_assistant" | "cancelled";
  progress: { label: string; done: number; total: number };
  error: { code: string; message: string } | null;
  result: Record<string, unknown> | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export const aiApi = {
  me: (config?: { quiet?: boolean; signal?: AbortSignal }) => api.get<UserAiMap>("/ai/me", config).then((r) => r.data),
  setFeature: (feature: string, body: { lane: AiLane; keyId?: string | null; model?: string | null }) =>
    api.put<UserAiMap>(`/ai/features/${encodeURIComponent(feature)}`, body).then((r) => r.data),
  resetFeature: (feature: string) => api.delete<UserAiMap>(`/ai/features/${encodeURIComponent(feature)}`).then((r) => r.data),
  resetMap: () => api.delete<UserAiMap>("/ai/features").then((r) => r.data),
  setDefaultKey: (keyId: string) => api.put<UserAiMap>("/ai/default-key", { keyId }).then((r) => r.data),
  addKey: (body: { provider: AiProviderId; name: string; secret: string; freeTier?: boolean }) =>
    api.post<AiKeyResult>("/ai/keys", body).then((r) => r.data),
  updateKey: (id: string, body: { name?: string; freeTier?: boolean; secret?: string }) =>
    api.patch<AiKeyResult>(`/ai/keys/${id}`, body).then((r) => r.data),
  checkKey: (id: string) => api.post<{ key: AiKey }>(`/ai/keys/${id}/check`).then((r) => r.data.key),
  models: (id: string) => api.get<{ models: AiModelInfo[] }>(`/ai/keys/${id}/models`, { quiet: true }).then((r) => r.data.models),
  deleteKey: (id: string) => api.delete<{ routesCleared: number; defaultMovedTo: string | null }>(`/ai/keys/${id}`).then((r) => r.data),
  usage: () => api.get<AiUsageSummary>("/ai/usage", { quiet: true }).then((r) => r.data),
  job: (id: string, config?: { signal?: AbortSignal }) => api.get<AiJob>(`/ai/jobs/${id}`, { quiet: true, ...config }).then((r) => r.data),
  cancelJob: (id: string) => api.post(`/ai/jobs/${id}/cancel`).then((r) => r.data),
};

/* ---------------- assistant connections (MCP) ---------------- */

export type McpScope = "read" | "write" | "ai";

export interface McpConnection {
  id: string;
  name: string;
  last4: string;
  scopes: McpScope[];
  lastClient: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const mcpApi = {
  list: () => api.get<{ tokens: McpConnection[] }>("/mcp-tokens", { quiet: true }).then((r) => r.data.tokens),
  /** The secret comes back once, here — it can't be read again. */
  create: (body: { name: string; scopes?: McpScope[] }) =>
    api.post<{ token: McpConnection; secret: string }>("/mcp-tokens", body).then((r) => r.data),
  revoke: (id: string) => api.delete(`/mcp-tokens/${id}`).then((r) => r.data),
};

/* ---------------- Admin ---------------- */

export interface AiFeatureRule {
  enabled: boolean;
  allowedLanes: AiLane[];
  forcedLane: AiLane | null;
  defaultLane: AiLane;
  includedMonthlyLimit: number;
}

export interface AiPolicy {
  aiEnabled: boolean;
  pauseMessage: string;
  userMapEnabled: boolean;
  lanes: { included: boolean; byok: boolean; assistant: boolean };
  budget: { monthlyCapUsd: number; perUserAllowanceUsd: number; alertAtPct: number[] };
  freeTierKeysForEmail: boolean;
  mcp: { enabled: boolean; callsPerHour: number; writesPerHour: number; writeToolsEnabled: boolean };
  features: Record<string, AiFeatureRule>;
  alertsSent: string[];
  updatedAt: string | null;
}

export interface AdminAiFeature extends AiFeatureInfo {
  rule: AiFeatureRule;
  keyId: string | null;
  pinnedKey: boolean;
  model: string | null;
  pinnedModel: boolean;
  provider: AiProviderId | null;
  providerLabel: string | null;
  activity: AiActivity;
  lanes7d: Record<string, number>;
}

export interface AdminAiMap {
  policy: AiPolicy;
  providers: AiProviderInfo[];
  keys: AiKey[];
  defaultKeyId: string | null;
  defaultModel: string | null;
  features: AdminAiFeature[];
}

export interface AdminAiUsage {
  period: string;
  resetsAt: string;
  capUsd: number;
  perUserAllowanceUsd: number;
  includedSpentUsd: number;
  features: { feature: string; calls: number; failures: number; refusals: number; cached: number; costUsd: number; tokens: number; lanes: Record<string, number> }[];
  providers: { provider: string; model: string; calls: number; failures: number; costUsd: number }[];
  failures: { code: string; n: number }[];
  refusals: { code: string; n: number }[];
  topUsers: { userId: string; name: string; email: string; costUsd: number; calls: number }[];
  daily: { day: string; costUsd: number; calls: number }[];
}

export interface AiUserOverride {
  suspended: boolean;
  allowanceUsd: number | null;
  forcedLane: AiLane | null;
  note: string;
}

export interface AdminAiUser {
  override: AiUserOverride;
  usage: AiUsageSummary;
  keys: { provider: AiProviderId; name: string; last4: string; healthy: boolean; createdAt: string }[];
  assistantTokens: number;
}

export type AiSettingsPatch = Partial<{
  aiEnabled: boolean;
  pauseMessage: string;
  userMapEnabled: boolean;
  lanes: Partial<AiPolicy["lanes"]>;
  budget: Partial<AiPolicy["budget"]>;
  freeTierKeysForEmail: boolean;
  mcp: Partial<AiPolicy["mcp"]>;
}>;

export const adminAiApi = {
  get: (config?: { quiet?: boolean }) => api.get<AdminAiMap>("/admin/ai", config).then((r) => r.data),
  updateSettings: (patch: AiSettingsPatch) => api.put<AiPolicy>("/admin/ai/settings", patch).then((r) => r.data),
  updateFeature: (feature: string, patch: Partial<AiFeatureRule>) =>
    api.put<AiPolicy>(`/admin/ai/features/${encodeURIComponent(feature)}`, patch).then((r) => r.data),
  setRoute: (feature: string, body: { keyId: string | null; model?: string | null }) =>
    api.put<AdminAiMap>(`/admin/ai/routes/${encodeURIComponent(feature)}`, body).then((r) => r.data),
  clearRoute: (feature: string) => api.delete<AdminAiMap>(`/admin/ai/routes/${encodeURIComponent(feature)}`).then((r) => r.data),
  addKey: (body: { provider: AiProviderId; name: string; secret: string; freeTier?: boolean }) =>
    api.post<AiKeyResult & { map: AdminAiMap }>("/admin/ai/keys", body).then((r) => r.data),
  updateKey: (id: string, body: { name?: string; secret?: string; freeTier?: boolean }) =>
    api.patch<AiKeyResult>(`/admin/ai/keys/${id}`, body).then((r) => r.data),
  checkKey: (id: string) => api.post<{ key: AiKey }>(`/admin/ai/keys/${id}/check`).then((r) => r.data.key),
  models: (id: string) => api.get<{ models: AiModelInfo[] }>(`/admin/ai/keys/${id}/models`, { quiet: true }).then((r) => r.data.models),
  deleteKey: (id: string) => api.delete<{ map: AdminAiMap }>(`/admin/ai/keys/${id}`).then((r) => r.data.map),
  usage: (period?: string) => api.get<AdminAiUsage>("/admin/ai/usage", { params: period ? { period } : undefined, quiet: true }).then((r) => r.data),
  getUser: (id: string) => api.get<AdminAiUser>(`/admin/ai/users/${id}`, { quiet: true }).then((r) => r.data),
  setUserOverride: (id: string, patch: Partial<AiUserOverride>) =>
    api.put<{ override: AiUserOverride }>(`/admin/ai/users/${id}`, patch).then((r) => r.data.override),
};

export { aiErrorCode, aiErrorFixableInSettings } from "./aiErrors.ts";

/** Where the work runs, for words: "HireTrail's included AI", "your Work key", … */
export function laneWords(lane: AiLane | null, keyName?: string | null): string {
  switch (lane) {
    case "included": return "HireTrail's included AI";
    case "byok": return keyName ? `your ${keyName} key` : "your own key";
    case "assistant": return "your assistant";
    case "off": return "nowhere — it's off";
    default: return "—";
  }
}
