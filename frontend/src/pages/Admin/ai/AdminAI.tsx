/** Admin → AI. HireTrail's side of the AI layer, in three views:
 *
 *   Map    — HireTrail's own keys and what Included runs on each (drag to
 *            re-route; open a feature for its model and rules)
 *   Rules  — the master switch, the user map, lanes, per-feature rules, MCP
 *   Spend  — the budget, this month's lens, per-person overrides
 *
 *  The view is in the URL (?view=rules) so links from elsewhere land on it. */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import toast from "../../../components/ui/toast.ts";

import PageHeader from "../../../components/ui/PageHeader.tsx";
import SegmentedControl from "../../../components/ui/SegmentedControl.tsx";
import Button from "../../../components/ui/Button.tsx";
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";
import AiMap from "../../../components/ai/AiMap.tsx";
import MapLegend from "../../../components/ai/MapLegend.tsx";
import AddKeyModal from "../../../components/ai/AddKeyModal.tsx";
import KeyList from "../../../components/ai/KeyList.tsx";
import { activeToday } from "../../../components/ai/format.ts";
import { SettingsSection } from "../../Settings/ui.tsx";
import { adminAiApi, type AiProviderId } from "../../../utils/aiApi.ts";
import { buildPlatformClusters, routeForDrop } from "./platformMapClusters.tsx";
import { ADMIN_AI_KEY, useAdminAi, useRefreshAdminAi, useSetPlatformRoute } from "./useAdminAi.ts";
import RulesTab from "./RulesTab.tsx";
import SpendTab from "./SpendTab.tsx";
import { useQueryClient } from "@tanstack/react-query";

type View = "map" | "rules" | "spend";

export default function AdminAI() {
  const [params, setParams] = useSearchParams();
  const view = (["map", "rules", "spend"].includes(params.get("view") ?? "") ? params.get("view") : "map") as View;
  const focusFeature = params.get("feature");
  const setView = (v: View, feature?: string) => {
    const next = new URLSearchParams(params);
    if (v === "map") next.delete("view"); else next.set("view", v);
    if (feature) next.set("feature", feature); else next.delete("feature");
    setParams(next, { replace: true });
  };

  const { data: map, isPending, isError, refetch } = useAdminAi();
  const route = useSetPlatformRoute();
  const refresh = useRefreshAdminAi();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const onRoute = useCallback((feature: string, keyId: string | null, model?: string | null, done?: string) => {
    route.mutate({ feature, keyId, model }, { onSuccess: () => { if (done) toast.success(done); } });
  }, [route]);

  const clusters = useMemo(
    () =>
      map
        ? buildPlatformClusters(map, {
            onRoute,
            onMakeDefault: (keyId) => {
              const k = map.keys.find((x) => x.id === keyId);
              route.mutate({ feature: "default", keyId }, { onSuccess: () => toast.success(`${k?.name ?? "That key"} is the default`) });
            },
            onCheckKey: (keyId) => {
              void adminAiApi.checkKey(keyId).then((k) => toast.success(`${k.name} is working`)).catch(() => undefined).finally(refresh);
            },
            onFocus: setFocusId,
            onOpenRules: (feature) => setView("rules", feature),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map],
  );

  const onDrop = useCallback((featureId: string, clusterId: string) => {
    if (!map) return;
    const r = routeForDrop(map, featureId, clusterId);
    if (r) onRoute(featureId, r.keyId, null, r.done);
  }, [map, onRoute]);

  const legend = useMemo(() => {
    if (!map) return null;
    const seen = new Map<AiProviderId, string>();
    for (const k of map.keys) seen.set(k.provider, k.providerLabel);
    return {
      providers: [...seen.entries()].map(([id, label]) => ({ id, label })),
      dashed: map.features.some((f) => f.keyId && !f.pinnedKey) ? "via the default key" : null,
      flowing: map.features.some((f) => activeToday(f.activity.lastAt)),
    };
  }, [map]);

  const runsPerKey = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of map?.features ?? []) if (f.keyId) out[f.keyId] = (out[f.keyId] ?? 0) + 1;
    return out;
  }, [map]);

  const focusName = focusId ? map?.keys.find((k) => `hub:key:${k.id}` === focusId)?.name : null;

  return (
    <div>
      <PageHeader
        title="AI"
        meta={map && !map.policy.aiEnabled ? <span className="text-amber-600 dark:text-amber-400">Paused for everyone</span> : undefined}
        actions={
          <>
            <SegmentedControl<View>
              size="sm"
              ariaLabel="View"
              value={view}
              onChange={(v) => setView(v)}
              segments={[{ value: "map", label: "Map" }, { value: "rules", label: "Rules" }, { value: "spend", label: "Spend" }]}
            />
            {view === "map" && (
              <Button size="sm" variant="primary" onClick={() => setAdding(true)} disabled={!map}>
                <Plus size={14} strokeWidth={2} aria-hidden />Add a key
              </Button>
            )}
          </>
        }
      />

      <div className="max-w-5xl">
        {isPending ? (
          <div className="surface-card p-6"><Skeleton className="h-64 w-full" /></div>
        ) : isError || !map ? (
          <div className="surface-card px-5 py-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Couldn't load the AI settings.</p>
            <Button size="sm" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : view === "rules" ? (
          <RulesTab map={map} focusFeature={focusFeature} />
        ) : view === "spend" ? (
          <SpendTab map={map} />
        ) : (
          <div className="space-y-8">
            <SettingsSection
              title="Where Included runs"
              description="HireTrail's own keys. A feature without its own route borrows the default key; drag one onto a key to pin it there. People's own keys and assistants aren't shown — they're theirs."
            >
              <div className="surface-card px-4 sm:px-6 pt-5 pb-4">
                {focusName && (
                  <button
                    type="button"
                    onClick={() => setFocusId(null)}
                    className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-control/60 py-0.5 pl-2.5 pr-1.5 text-[12px] font-medium text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    What {focusName} runs
                    <X size={12} strokeWidth={2} className="text-muted-foreground" aria-hidden />
                  </button>
                )}
                <AiMap clusters={clusters} onDrop={onDrop} focusId={focusId} ariaLabel="Where Included runs" />
                {legend && (
                  <div className="mt-2 pt-3 border-t border-border">
                    <MapLegend providers={legend.providers} dashed={legend.dashed} flowing={legend.flowing} hint={map.keys.length > 1 ? "drag a feature onto a key to pin it there" : undefined} />
                  </div>
                )}
              </div>
            </SettingsSection>

            <SettingsSection title="HireTrail's keys" description="Tested on save. Included spend on these keys counts against the monthly cap.">
              <KeyList
                keys={map.keys}
                defaultKeyId={map.defaultKeyId}
                providers={map.providers}
                runs={runsPerKey}
                onChanged={refresh}
                onAdd={() => setAdding(true)}
                actions={{
                  update: (id, body) => adminAiApi.updateKey(id, body),
                  check: (id) => adminAiApi.checkKey(id),
                  remove: async (id) => qc.setQueryData(ADMIN_AI_KEY, await adminAiApi.deleteKey(id)),
                  setDefault: (id) => route.mutateAsync({ feature: "default", keyId: id }),
                }}
                empty={
                  <>
                    <p className="text-sm font-medium text-foreground">No keys yet</p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed max-w-md">
                      Add HireTrail's first key and Included runs every feature on it. Until then, only people's own keys and assistants work.
                    </p>
                  </>
                }
              />
            </SettingsSection>
          </div>
        )}
      </div>

      {adding && map && (
        <AddKeyModal
          title="Add a HireTrail key"
          description="Included runs on this key and its spend counts against the monthly cap. It's tested before it's saved."
          nicknamePrefix="HireTrail "
          providers={map.providers}
          onClose={() => setAdding(false)}
          onSubmit={async (body) => {
            const r = await adminAiApi.addKey(body);
            qc.setQueryData(ADMIN_AI_KEY, r.map);
            return r;
          }}
        />
      )}
    </div>
  );
}
