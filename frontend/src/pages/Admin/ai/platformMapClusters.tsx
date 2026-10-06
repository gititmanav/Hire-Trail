/** Admin → AI's map: HireTrail's own keys, each with the features its
 *  Included lane runs on it. A feature without its own route borrows the
 *  default key (a still dash); "No key" holds what nothing powers. Dropping a
 *  feature on a key pins it there; dropping it on the default key's cluster
 *  removes the pin, so it follows the default again. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";

import Select from "../../../components/ui/Select.tsx";
import Button from "../../../components/ui/Button.tsx";
import FeatureGlyph from "../../../components/ai/FeatureGlyph.tsx";
import ProviderMark from "../../../components/ai/ProviderMark.tsx";
import KeyHealth from "../../../components/ai/KeyHealth.tsx";
import { activeToday, count, sinceLabel } from "../../../components/ai/format.ts";
import { providerColor } from "../../../components/ai/providerStyle.ts";
import { edgeWidth } from "../../../components/ai/mapLayout.ts";
import type { MapClusterSpec, MapSatSpec } from "../../../components/ai/AiMap.tsx";
import { cssPalette } from "../../../utils/palette.ts";
import { adminAiApi, LANE_LABEL, type AdminAiFeature, type AdminAiMap, type AiLane } from "../../../utils/aiApi.ts";

const MUTED = "hsl(var(--muted-foreground))";

export interface PlatformMapHandlers {
  onRoute: (feature: string, keyId: string | null, model?: string | null, done?: string) => void;
  onMakeDefault: (keyId: string) => void;
  onCheckKey: (keyId: string) => void;
  onFocus: (nodeId: string | null) => void;
  onOpenRules: (feature: string) => void;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{children}</span>
    </div>
  );
}

function ruleLine(f: AdminAiFeature): string {
  const r = f.rule;
  if (!r.enabled) return "Off for everyone";
  if (r.forcedLane) return `Everyone runs it on ${LANE_LABEL[r.forcedLane]}`;
  return `People choose: ${r.allowedLanes.map((l: AiLane) => LANE_LABEL[l]).join(", ")} · default ${LANE_LABEL[r.defaultLane]}`;
}

function PlatformFeatureCard({ f, map, h }: { f: AdminAiFeature; map: AdminAiMap; h: PlatformMapHandlers }) {
  const key = map.keys.find((k) => k.id === f.keyId) ?? null;
  const models = useQuery({
    queryKey: ["admin", "ai", "models", key?.id],
    queryFn: () => adminAiApi.models(key!.id),
    enabled: !!key,
    staleTime: 10 * 60_000,
    retry: false,
    meta: { silent: true },
  });
  const [model, setModel] = useState(f.model ?? "");
  useEffect(() => setModel(f.model ?? ""), [f.model]);
  const lanes = Object.entries(f.lanes7d).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-7 h-7 shrink-0 grid place-items-center rounded-lg bg-control text-foreground/80">
          <FeatureGlyph icon={f.icon} size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground leading-snug">{f.label}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{ruleLine(f)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <Fact label="Included runs on">
          {key ? (
            <span className="inline-flex items-center gap-1.5"><ProviderMark provider={key.provider} size={14} />{key.name}{!f.pinnedKey && <span className="text-muted-foreground"> · default</span>}</span>
          ) : "No key — Included can't run it"}
        </Fact>
        {f.model && <Fact label="Model"><code className="font-mono text-[11.5px]">{f.model}</code></Fact>}
        <Fact label="This week (Included)">{f.activity.calls7d ? `${count(f.activity.calls7d, "run")}${f.activity.failures7d ? ` · ${f.activity.failures7d} failed` : ""}` : "Not used"}</Fact>
        {lanes.length > 0 && (
          <Fact label="Everyone, by lane">{lanes.map(([l, n]) => `${LANE_LABEL[l as AiLane] ?? l} ${n}`).join(" · ")}</Fact>
        )}
        {f.activity.lastAt && <Fact label="Last run">{sinceLabel(f.activity.lastAt)}</Fact>}
      </div>
      {key && (
        <div className="border-t border-border pt-3">
          <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Model</p>
          {models.isError ? (
            <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">Couldn't fetch this key's models. Check the key below the map.</p>
          ) : (
            <Select
              size="sm"
              ariaLabel="Model"
              searchable
              searchPlaceholder="Search models…"
              placeholder={models.isPending ? "Fetching models…" : "Pick a model"}
              disabled={models.isPending}
              value={model}
              onChange={setModel}
              options={(models.data ?? []).map((m) => ({ value: m.id, label: m.id, description: m.label !== m.id ? m.label : undefined }))}
            />
          )}
          <div className="mt-2 flex items-center gap-2">
            {model && model !== f.model && (
              <Button size="sm" variant="primary" onClick={() => h.onRoute(f.id, key.id, model, `${f.label} now uses ${model}`)}>Use this model</Button>
            )}
            {f.pinnedModel && (
              <Button size="sm" variant="ghost" onClick={() => h.onRoute(f.id, key.id, null, `${f.label} uses its default model again`)}>Use the default model</Button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => h.onOpenRules(f.id)}
        className="text-[12px] font-medium text-foreground hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Edit its rules
      </button>
    </div>
  );
}

export function buildPlatformClusters(map: AdminAiMap, h: PlatformMapHandlers): MapClusterSpec[] {
  const sat = (f: AdminAiFeature, failing: boolean, color: string, dashed: boolean): MapSatSpec => ({
    id: f.id,
    face: f.shortLabel,
    glyph: <FeatureGlyph icon={f.icon} size={18} className={f.rule.enabled ? "text-foreground/75" : "text-muted-foreground"} />,
    ariaLabel: `${f.label} — open for its model and rules`,
    muted: !f.rule.enabled,
    failing,
    draggable: map.keys.length > 0,
    edge: { color: failing ? cssPalette("red-500") : color, width: edgeWidth(f.activity.calls7d), dashed, pulse: activeToday(f.activity.lastAt) },
    cardWidth: 316,
    card: () => <PlatformFeatureCard f={f} map={map} h={h} />,
  });

  const clusters: MapClusterSpec[] = map.keys.map((k) => {
    const here = map.features.filter((f) => f.keyId === k.id);
    const isDefault = k.id === map.defaultKeyId;
    return {
      id: `key:${k.id}`,
      hub: {
        id: `hub:key:${k.id}`,
        face: k.name,
        sub: isDefault ? "Default key" : k.providerLabel,
        glyph: <ProviderMark provider={k.provider} size={30} />,
        ariaLabel: `${k.name} (${k.providerLabel})`,
        failing: !!k.lastError,
        card: () => (
          <div className="p-3.5 space-y-2">
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">{k.name}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{k.providerLabel} · ••••{k.last4}{isDefault ? " · the default key" : ""}</p>
            </div>
            <KeyHealth k={k} />
            <p className="text-[12px] text-muted-foreground">
              {here.length ? `Runs ${count(here.length, "feature")} for everyone on Included` : "Nothing runs on it — drag a feature here."}
            </p>
            <div className="flex items-center gap-3 pt-0.5">
              <button type="button" onClick={() => h.onCheckKey(k.id)} className="text-[12px] font-medium text-foreground hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Check now</button>
              {!isDefault && (
                <button type="button" onClick={() => h.onMakeDefault(k.id)} className="text-[12px] font-medium text-foreground hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Make default</button>
              )}
              {here.length > 0 && (
                <button type="button" onClick={() => h.onFocus(`hub:key:${k.id}`)} className="text-[12px] font-medium text-foreground hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">What it runs</button>
              )}
            </div>
          </div>
        ),
      },
      sats: here.map((f) => sat(f, !!k.lastError, providerColor(k.provider), !f.pinnedKey)),
      accepts: (id) => {
        const f = map.features.find((x) => x.id === id);
        return !!f && !(f.keyId === k.id && (f.pinnedKey || isDefault));
      },
    };
  });

  const unpowered = map.features.filter((f) => !f.keyId);
  if (unpowered.length || !map.keys.length) {
    clusters.push({
      id: "nokey",
      hub: {
        id: "hub:nokey",
        face: "No key",
        sub: "Included can't run these",
        glyph: <KeyRound size={20} strokeWidth={1.7} className="text-muted-foreground" />,
        hub: true,
        muted: true,
        ariaLabel: "No key — features here can't run on Included",
        card: () => (
          <div className="p-3.5 space-y-1.5">
            <p className="text-[13.5px] font-semibold text-foreground">No key</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {map.keys.length
                ? "Nothing powers these on Included. Drag one onto a key, or make a key the default."
                : "Add HireTrail's first key and every feature runs on it by default. Until then Included can't run anything — people's own keys and assistants still work."}
            </p>
          </div>
        ),
      },
      sats: unpowered.map((f) => sat(f, false, MUTED, true)),
      accepts: () => false,
    });
  }
  return clusters;
}

/** What a drop means: pin to that key — or, on the default key, follow the default. */
export function routeForDrop(map: AdminAiMap, featureId: string, clusterId: string): { keyId: string | null; done: string } | null {
  const f = map.features.find((x) => x.id === featureId);
  const k = map.keys.find((x) => `key:${x.id}` === clusterId);
  if (!f || !k) return null;
  if (k.id === map.defaultKeyId) return { keyId: null, done: `${f.label} follows the default key (${k.name})` };
  return { keyId: k.id, done: `${f.label} now runs on ${k.name}` };
}
