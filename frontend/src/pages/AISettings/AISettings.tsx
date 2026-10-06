/**
 * Settings → AI ("My AI"). Where each AI feature runs, and everything behind it.
 *
 *   Where it runs — the map: Included, each of your keys, your assistant,
 *                   Off — drag a feature between them, or open it to choose
 *   This month    — the Included allowance and what each feature used
 *   Your keys     — tested on save; health in plain words; edit / delete
 *   Your assistant— connect Claude Code (MCP)
 *   Importing     — combine a new resume with the profile, or replace it
 *
 * The demo account sees its map read-only (every write is refused server-side
 * too); the admin can lock features or the whole map, which the map shows.
 */
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, Lock, X } from "lucide-react";
import toast from "../../components/ui/toast.ts";

import { UserContext } from "../../App.tsx";
import { ThemeContext } from "../../hooks/useTheme.tsx";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import { api } from "../../utils/api.ts";
import type { User } from "../../types";
import { aiApi, type AiProviderId } from "../../utils/aiApi.ts";
import { prefersReducedMotion } from "../../utils/motion.ts";
import AiMap from "../../components/ai/AiMap.tsx";
import MapLegend from "../../components/ai/MapLegend.tsx";
import AddKeyModal from "../../components/ai/AddKeyModal.tsx";
import KeyList from "../../components/ai/KeyList.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import Button from "../../components/ui/Button.tsx";
import { SettingsCard, SettingsHeader, SettingsRow, SettingsSection } from "../Settings/ui.tsx";
import { buildUserClusters, moveForDrop } from "./userMapClusters.tsx";
import { useMoveFeature, useMyAi, useRefreshMyAi, useResetFeature, useSetDefaultKey } from "./useMyAi.ts";
import UsageSection from "./UsageSection.tsx";
import AssistantSection from "./AssistantSection.tsx";

type Section = "map" | "usage" | "keys" | "assistant";

function MapSkeleton() {
  return (
    <div className="surface-card p-5" aria-hidden>
      <div className="h-64 grid grid-cols-2 sm:grid-cols-4 place-items-center gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="w-14 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportPreference() {
  const { user, setUser } = useContext(UserContext);
  const { requireRealAccount } = useDemoGate();
  const [merge, setMerge] = useState(user?.mergeResumesEnabled !== false);
  const [saving, setSaving] = useState(false);

  const save = async (next: boolean) => {
    if (next === merge || !requireRealAccount("Profile import settings")) return;
    setMerge(next);
    setSaving(true);
    try {
      const res = await api.put<User>("/auth/profile", { mergeResumesEnabled: next });
      setUser(res.data);
      toast.success(next ? "New resumes will be combined with your profile" : "New resumes will replace your profile");
    } catch {
      setMerge(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard>
      <SettingsRow
        title="When you import another resume"
        description={
          merge
            ? "It's combined with your profile — nothing you already have is dropped. You can undo an import on the Profile page."
            : "It replaces your profile. You can still undo an import on the Profile page."
        }
      >
        <SegmentedControl<"merge" | "replace">
          size="sm"
          ariaLabel="When you import another resume"
          value={merge ? "merge" : "replace"}
          onChange={(v) => { if (!saving) void save(v === "merge"); }}
          segments={[{ value: "merge", label: "Combine" }, { value: "replace", label: "Replace" }]}
        />
      </SettingsRow>
    </SettingsCard>
  );
}

export default function AISettings() {
  const { data: map, isPending, isError, refetch } = useMyAi();
  const move = useMoveFeature();
  const reset = useResetFeature();
  const setDefault = useSetDefaultKey();
  const refresh = useRefreshMyAi();
  const { dark } = useContext(ThemeContext);
  const { isDemo, requireRealAccount } = useDemoGate();
  const [adding, setAdding] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const refs = useRef<Partial<Record<Section, HTMLElement | null>>>({});

  const scrollTo = useCallback((s: Section) => {
    refs.current[s]?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  const clusters = useMemo(
    () =>
      map
        ? buildUserClusters(map, {
            onMove: (m) => { if (requireRealAccount("Changing where AI runs")) move.mutate(m); },
            onReset: (id) => { if (requireRealAccount("Changing where AI runs")) reset.mutate(id); },
            onCheckKey: (id) => {
              void aiApi.checkKey(id).then((k) => toast.success(`${k.name} is working`)).catch(() => undefined).finally(refresh);
            },
            onFocusKey: setFocusId,
            onScrollTo: (s) => scrollTo(s === "usage" ? "usage" : s),
            busy: move.isPending,
            isDark: dark,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, dark, move.isPending],
  );

  const onDrop = useCallback((featureId: string, clusterId: string) => {
    if (!map || !requireRealAccount("Changing where AI runs")) return;
    const m = moveForDrop(map, featureId, clusterId);
    if (m) move.mutate(m);
  }, [map, move, requireRealAccount]);

  const runsPerKey = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of map?.features ?? []) if (f.lane === "byok" && f.keyId) out[f.keyId] = (out[f.keyId] ?? 0) + 1;
    return out;
  }, [map]);

  const legend = useMemo(() => {
    if (!map) return null;
    const seen = new Map<AiProviderId, string>();
    if (map.included.available && map.included.provider) seen.set(map.included.provider, map.included.providerLabel ?? map.included.provider);
    for (const k of map.keys) seen.set(k.provider, k.providerLabel);
    return {
      providers: [...seen.entries()].map(([id, label]) => ({ id, label })),
      dashed: map.features.some((f) => f.lane === "byok" && !f.pinnedKey) ? "on your default key" : null,
      flowing: map.features.some((f) => f.activity.lastAt && Date.now() - new Date(f.activity.lastAt).getTime() < 86_400_000),
    };
  }, [map]);

  const focusName = focusId?.startsWith("hub:key:") ? map?.keys.find((k) => `hub:key:${k.id}` === focusId)?.name : null;

  return (
    <div className="max-w-4xl">
      <SettingsHeader
        title="AI"
        description="Choose where each AI feature runs. HireTrail's included AI is free within a monthly allowance; your own key or your AI assistant have no limit."
      />

      {map && !map.policy.aiEnabled && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          {map.policy.pauseMessage || "HireTrail has paused AI for now. Everything else works as usual."}
        </div>
      )}

      <section ref={(el) => { refs.current.map = el; }} className="scroll-mt-6">
        <SettingsSection
          title="Where it runs"
          description={
            map && !map.policy.userMapEnabled
              ? "HireTrail sets where AI runs right now. Open a feature to see where it runs and why."
              : "Drag a feature onto another hub to move it — or open it to choose. Your keys are never shown, only their nicknames."
          }
        >
          {isPending ? (
            <MapSkeleton />
          ) : isError || !map ? (
            <div className="surface-card px-5 py-6 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Couldn't load your AI settings.</p>
              <Button size="sm" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : (
            <div className="surface-card px-4 sm:px-6 pt-5 pb-4">
              {(focusName || !map.policy.userMapEnabled || isDemo) && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {focusName && (
                    <button
                      type="button"
                      onClick={() => setFocusId(null)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-control/60 py-0.5 pl-2.5 pr-1.5 text-[12px] font-medium text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      What {focusName} runs
                      <X size={12} strokeWidth={2} className="text-muted-foreground" aria-hidden />
                    </button>
                  )}
                  {(!map.policy.userMapEnabled || isDemo) && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Lock size={12} strokeWidth={2} aria-hidden />
                      {isDemo ? "Read-only on the demo account" : "Set by HireTrail"}
                    </span>
                  )}
                </div>
              )}
              <AiMap
                clusters={clusters}
                onDrop={onDrop}
                focusId={focusId}
                ariaLabel="Where each AI feature runs"
              />
              {legend && (
                <div className="mt-2 pt-3 border-t border-border">
                  <MapLegend
                    providers={legend.providers}
                    dashed={legend.dashed}
                    flowing={legend.flowing}
                  />
                </div>
              )}
            </div>
          )}
        </SettingsSection>
      </section>

      {map && (
        <>
          <section ref={(el) => { refs.current.usage = el; }} className="mt-8 scroll-mt-6">
            <SettingsSection title="This month" description="What AI did for you since the 1st.">
              <UsageSection map={map} />
            </SettingsSection>
          </section>

          {map.policy.lanes.byok && (
            <section ref={(el) => { refs.current.keys = el; }} className="mt-8 scroll-mt-6">
              <SettingsSection
                title="Your keys"
                description="Bring a key from any of these providers and run features on it — billed by your provider, with no HireTrail limit. Each key is tested before it's saved."
              >
                <KeyList
                  keys={map.keys}
                  defaultKeyId={map.defaultKeyId}
                  providers={map.providers}
                  runs={runsPerKey}
                  onChanged={refresh}
                  onAdd={() => { if (requireRealAccount("Adding an AI key")) setAdding(true); }}
                  actions={{
                    update: (id, body) => aiApi.updateKey(id, body),
                    check: (id) => aiApi.checkKey(id),
                    remove: (id) => aiApi.deleteKey(id),
                    setDefault: (id) => setDefault.mutateAsync(id),
                  }}
                  empty={
                    <>
                      <p className="text-sm font-medium text-foreground">No keys yet</p>
                      <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed max-w-md">
                        A free Google Gemini key takes a minute to make at Google AI Studio, and keeps AI running past the included allowance.
                      </p>
                    </>
                  }
                />
              </SettingsSection>
            </section>
          )}

          {map.policy.lanes.assistant && (
            <section ref={(el) => { refs.current.assistant = el; }} className="mt-8 scroll-mt-6">
              <SettingsSection
                title="Your assistant"
                description="Connect Claude Code (or any MCP assistant). It can read your search, track and update jobs, and run the features you put in the My assistant lane — on your own subscription."
              >
                <AssistantSection enabled={map.policy.mcpEnabled && !isDemo} />
              </SettingsSection>
            </section>
          )}

          <div className="mt-8">
            <SettingsSection title="Importing resumes">
              <ImportPreference />
            </SettingsSection>
          </div>
        </>
      )}

      {adding && map && (
        <AddKeyModal
          providers={map.providers}
          onClose={() => setAdding(false)}
          onSubmit={async (body) => {
            const r = await aiApi.addKey(body);
            refresh();
            return r;
          }}
        />
      )}
    </div>
  );
}

