/** My AI's server state: the map, and the moves made on it.
 *
 *  Moving a feature is optimistic — it lands in its new cluster at once and
 *  the server's answer (the whole map) replaces it; a refusal rolls it back
 *  and the API layer's toast says why. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "../../components/ui/toast.ts";

import { aiApi, type AiLane, type UserAiMap } from "../../utils/aiApi.ts";

export const MY_AI_KEY = ["ai", "me"] as const;

export function useMyAi() {
  return useQuery({
    queryKey: MY_AI_KEY,
    queryFn: ({ signal }) => aiApi.me({ quiet: true, signal }),
    meta: { errorMessage: "Couldn't load your AI settings." },
  });
}

export interface MoveInput {
  feature: string;
  lane: AiLane;
  keyId?: string | null;
  model?: string | null;
  /** The sentence for the confirmation toast. */
  done?: string;
}

export function useMoveFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: MoveInput) => aiApi.setFeature(m.feature, { lane: m.lane, keyId: m.keyId ?? null, model: m.model ?? null }),
    onMutate: async (m) => {
      await qc.cancelQueries({ queryKey: MY_AI_KEY });
      const prev = qc.getQueryData<UserAiMap>(MY_AI_KEY);
      if (prev) {
        qc.setQueryData<UserAiMap>(MY_AI_KEY, {
          ...prev,
          features: prev.features.map((f) => {
            if (f.id !== m.feature) return f;
            const key = m.lane === "byok" ? prev.keys.find((k) => k.id === (m.keyId ?? prev.defaultKeyId)) : null;
            return {
              ...f,
              lane: m.lane,
              userChoice: true,
              keyId: key?.id ?? null,
              pinnedKey: m.lane === "byok" && !!m.keyId,
              provider: m.lane === "byok" ? key?.provider ?? null : m.lane === "included" ? prev.included.provider : null,
              providerLabel: m.lane === "byok" ? key?.providerLabel ?? null : m.lane === "included" ? prev.included.providerLabel : null,
              model: m.model ?? (m.lane === f.lane && m.keyId === f.keyId ? f.model : null),
              pinnedModel: !!m.model,
            };
          }),
        });
      }
      return { prev };
    },
    onError: (_e, _m, ctx) => {
      if (ctx?.prev) qc.setQueryData(MY_AI_KEY, ctx.prev);
    },
    onSuccess: (map, m) => {
      qc.setQueryData(MY_AI_KEY, map);
      if (m.done) toast.success(m.done);
    },
  });
}

export function useResetFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feature: string) => aiApi.resetFeature(feature),
    onSuccess: (map) => {
      qc.setQueryData(MY_AI_KEY, map);
      toast.success("Back to the default");
    },
  });
}

export function useSetDefaultKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => aiApi.setDefaultKey(keyId),
    onSuccess: (map) => {
      qc.setQueryData(MY_AI_KEY, map);
      toast.success("Default key changed");
    },
  });
}

/** After a key is added, rotated, checked or deleted: refresh the map. */
export function useRefreshMyAi() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MY_AI_KEY });
}
