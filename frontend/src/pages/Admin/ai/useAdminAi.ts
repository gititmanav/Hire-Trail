/** Admin → AI server state. Every write returns the new policy or map, which
 *  replaces the cache — no refetch round-trip, and the screen never shows a
 *  setting the server didn't keep. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminAiApi, type AdminAiMap, type AiFeatureRule, type AiPolicy, type AiSettingsPatch } from "../../../utils/aiApi.ts";

export const ADMIN_AI_KEY = ["admin", "ai"] as const;

export function useAdminAi() {
  return useQuery({
    queryKey: ADMIN_AI_KEY,
    queryFn: () => adminAiApi.get({ quiet: true }),
    meta: { errorMessage: "Couldn't load the AI settings." },
  });
}

export function useAdminAiUsage(period?: string) {
  return useQuery({
    queryKey: [...ADMIN_AI_KEY, "usage", period ?? "current"],
    queryFn: () => adminAiApi.usage(period),
    meta: { errorMessage: "Couldn't load AI spend." },
  });
}

function withPolicy(qc: ReturnType<typeof useQueryClient>, policy: AiPolicy) {
  qc.setQueryData<AdminAiMap>(ADMIN_AI_KEY, (prev) =>
    prev ? { ...prev, policy, features: prev.features.map((f) => ({ ...f, rule: policy.features[f.id] ?? f.rule })) } : prev,
  );
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AiSettingsPatch) => adminAiApi.updateSettings(patch),
    onSuccess: (policy) => withPolicy(qc, policy),
  });
}

export function useUpdateFeatureRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feature, patch }: { feature: string; patch: Partial<AiFeatureRule> }) => adminAiApi.updateFeature(feature, patch),
    onSuccess: (policy) => withPolicy(qc, policy),
  });
}

export function useSetPlatformRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feature, keyId, model }: { feature: string; keyId: string | null; model?: string | null; done?: string }) =>
      keyId ? adminAiApi.setRoute(feature, { keyId, model: model ?? null }) : adminAiApi.clearRoute(feature),
    onSuccess: (map) => qc.setQueryData(ADMIN_AI_KEY, map),
  });
}

export function useRefreshAdminAi() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ADMIN_AI_KEY });
}
