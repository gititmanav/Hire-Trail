/** My AI's map, as clusters: Included, each of your keys, your assistant and
 *  Off — every feature orbiting the place it runs. Edges carry the facts:
 *  provider colour, a still dash when it borrows your default key, a flow
 *  when it ran in the last day, red when its key is failing. */
import { PauseCircle, PowerOff, SquareTerminal } from "lucide-react";

import BrandMark from "../../components/BrandMark/BrandMark.tsx";
import FeatureGlyph from "../../components/ai/FeatureGlyph.tsx";
import ProviderMark from "../../components/ai/ProviderMark.tsx";
import KeyHealth from "../../components/ai/KeyHealth.tsx";
import { activeToday, count, shortDate, sinceLabel, usd } from "../../components/ai/format.ts";
import { providerColor } from "../../components/ai/providerStyle.ts";
import { cssPalette } from "../../utils/palette.ts";
import { edgeWidth } from "../../components/ai/mapLayout.ts";
import type { MapClusterSpec, MapSatSpec } from "../../components/ai/AiMap.tsx";
import type { AiMapFeature, UserAiMap } from "../../utils/aiApi.ts";
import FeatureCard from "./FeatureCard.tsx";
import type { MoveInput } from "./useMyAi.ts";

const MUTED = "hsl(var(--muted-foreground))";
const FAILING = cssPalette("red-500");

export interface UserMapHandlers {
  onMove: (m: MoveInput) => void;
  onReset: (featureId: string) => void;
  onCheckKey: (keyId: string) => void;
  onFocusKey: (nodeId: string | null) => void;
  onScrollTo: (section: "keys" | "assistant" | "usage") => void;
  busy: boolean;
  isDark: boolean;
}

function HubCard({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="p-3.5 space-y-2">
      <div>
        <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
        {sub && <p className="text-[12px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-medium text-foreground hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      {children}
    </button>
  );
}

export function buildUserClusters(map: UserAiMap, h: UserMapHandlers): MapClusterSpec[] {
  const { policy, included, assistant, keys } = map;
  const featureById = new Map(map.features.map((f) => [f.id, f]));
  const canTake = (f: AiMapFeature | undefined, lane: AiMapFeature["choosable"][number]) =>
    !!f && !f.lock && policy.userMapEnabled && f.choosable.includes(lane);

  const sat = (f: AiMapFeature, edge: MapSatSpec["edge"]): MapSatSpec => ({
    id: f.id,
    face: f.shortLabel,
    glyph: <FeatureGlyph icon={f.icon} size={18} className={f.refusal ? "text-red-500" : "text-foreground/75"} />,
    ariaLabel: `${f.label} — open to change where it runs`,
    failing: !!f.refusal && f.lane !== "off",
    muted: f.lane === "off" || !f.lane,
    draggable: !f.lock && policy.userMapEnabled && f.choosable.length > 1,
    edge,
    cardWidth: 312,
    card: () => <FeatureCard f={f} map={map} busy={h.busy} onMove={h.onMove} onReset={() => h.onReset(f.id)} />,
  });
  const pulse = (f: AiMapFeature) => activeToday(f.activity.lastAt);

  const clusters: MapClusterSpec[] = [];

  /* Included — HireTrail's own key, within the monthly allowance. */
  if (policy.lanes.included) {
    const here = map.features.filter((f) => f.lane === "included");
    const { spentUsd, allowanceUsd } = map.usage.included;
    clusters.push({
      id: "included",
      hub: {
        id: "hub:included",
        face: "Included",
        sub: included.available ? included.providerLabel ?? "HireTrail" : "Not set up",
        glyph: <BrandMark size={30} tone={h.isDark ? "dark" : "light"} />,
        ariaLabel: "Included AI — HireTrail pays",
        muted: !included.available,
        card: () => (
          <HubCard title="Included" sub={included.available ? `HireTrail pays${included.providerLabel ? ` · runs on ${included.providerLabel}` : ""}` : "HireTrail hasn't set up included AI yet."}>
            {included.available && allowanceUsd > 0 && (
              <div className="space-y-1.5">
                <div className="h-1.5 rounded-full bg-control overflow-hidden">
                  <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, (spentUsd / allowanceUsd) * 100)}%` }} />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {usd(spentUsd)} of your {usd(allowanceUsd)} this month · resets {shortDate(map.usage.resetsAt)}
                </p>
              </div>
            )}
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Free within your monthly allowance. Your own key or your assistant have no limit.
            </p>
            <LinkButton onClick={() => h.onScrollTo("usage")}>See this month</LinkButton>
          </HubCard>
        ),
      },
      sats: here.map((f) =>
        sat(f, {
          color: f.refusal ? FAILING : providerColor(f.provider ?? included.provider),
          width: edgeWidth(f.activity.calls7d),
          dashed: false,
          pulse: pulse(f),
        }),
      ),
      accepts: (id) => included.available && canTake(featureById.get(id), "included"),
    });
  }

  /* Each of your keys. */
  if (policy.lanes.byok) {
    for (const k of keys) {
      const here = map.features.filter((f) => f.lane === "byok" && f.keyId === k.id);
      const isDefault = k.id === map.defaultKeyId;
      clusters.push({
        id: `key:${k.id}`,
        hub: {
          id: `hub:key:${k.id}`,
          face: k.name,
          sub: isDefault ? "Default key" : k.providerLabel,
          glyph: <ProviderMark provider={k.provider} size={30} />,
          ariaLabel: `Your ${k.name} key (${k.providerLabel})`,
          failing: !!k.lastError,
          card: () => (
            <HubCard title={k.name} sub={`${k.providerLabel} · ••••${k.last4}${isDefault ? " · your default key" : ""}`}>
              <KeyHealth k={k} />
              <p className="text-[12px] text-muted-foreground">{here.length ? `Runs ${count(here.length, "feature")}` : "Nothing runs on it yet — drag a feature here."}</p>
              <div className="flex items-center gap-3 pt-0.5">
                <LinkButton onClick={() => h.onCheckKey(k.id)}>Check now</LinkButton>
                {here.length > 0 && <LinkButton onClick={() => h.onFocusKey(`hub:key:${k.id}`)}>What it runs</LinkButton>}
                <LinkButton onClick={() => h.onScrollTo("keys")}>Manage</LinkButton>
              </div>
            </HubCard>
          ),
        },
        sats: here.map((f) =>
          sat(f, {
            color: k.lastError || f.refusal ? FAILING : providerColor(k.provider),
            width: edgeWidth(f.activity.calls7d),
            dashed: !f.pinnedKey,
            pulse: pulse(f),
          }),
        ),
        accepts: (id) => {
          const f = featureById.get(id);
          if (!canTake(f, "byok")) return false;
          // Email never goes to a free-tier key (unless HireTrail allows it).
          return !(k.freeTier && f!.dataClass === "email" && !policy.freeTierKeysForEmail);
        },
      });
    }
  }

  /* Your assistant (MCP). */
  if (policy.lanes.assistant) {
    const here = map.features.filter((f) => f.lane === "assistant");
    clusters.push({
      id: "assistant",
      hub: {
        id: "hub:assistant",
        face: "Assistant",
        sub: assistant.connected ? assistant.client ?? "Connected" : "Not connected",
        glyph: <SquareTerminal size={22} strokeWidth={1.7} className="text-foreground/80" />,
        hub: true,
        ariaLabel: "Your AI assistant",
        muted: !assistant.connected,
        card: () => (
          <HubCard
            title="Your assistant"
            sub={assistant.connected ? `Connected${assistant.client ? ` · ${assistant.client}` : ""}${assistant.lastUsedAt ? ` · last used ${sinceLabel(assistant.lastUsedAt)}` : ""}` : "Not connected yet"}
          >
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Features here run in your own AI assistant — Claude Code and others — on your subscription. They wait until you ask it.
            </p>
            <LinkButton onClick={() => h.onScrollTo("assistant")}>{assistant.connected ? "Manage the connection" : "Connect your assistant"}</LinkButton>
          </HubCard>
        ),
      },
      sats: here.map((f) => sat(f, { color: MUTED, width: edgeWidth(f.activity.calls7d), dashed: true, pulse: pulse(f) })),
      accepts: (id) => canTake(featureById.get(id), "assistant"),
    });
  }

  /* Off. */
  const off = map.features.filter((f) => f.lane === "off");
  clusters.push({
    id: "off",
    hub: {
      id: "hub:off",
      face: "Off",
      glyph: <PowerOff size={20} strokeWidth={1.7} className="text-muted-foreground" />,
      hub: true,
      muted: off.length === 0,
      ariaLabel: "Off — features here don't run",
      card: () => (
        <HubCard title="Off" sub="Features here don't run.">
          {off.length ? (
            <ul className="space-y-1.5">
              {off.map((f) => (
                <li key={f.id} className="text-[12px] leading-relaxed">
                  <span className="font-medium text-foreground">{f.label}.</span>{" "}
                  <span className="text-muted-foreground">{f.offMeans ?? ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">Drag a feature here to switch it off.</p>
          )}
        </HubCard>
      ),
    },
    sats: off.map((f) => sat(f, { color: MUTED, width: 1.5, dashed: true, pulse: false })),
    accepts: (id) => canTake(featureById.get(id), "off"),
  });

  /* Paused — AI switched off by HireTrail (nothing can be dropped here). */
  const paused = map.features.filter((f) => !f.lane);
  if (paused.length) {
    clusters.push({
      id: "paused",
      hub: {
        id: "hub:paused",
        face: "Paused",
        glyph: <PauseCircle size={20} strokeWidth={1.7} className="text-muted-foreground" />,
        hub: true,
        ariaLabel: "Paused by HireTrail",
        card: () => (
          <HubCard title="Paused" sub="HireTrail has paused these for now.">
            {policy.pauseMessage && <p className="text-[12px] text-muted-foreground leading-relaxed">{policy.pauseMessage}</p>}
          </HubCard>
        ),
      },
      sats: paused.map((f) => sat(f, { color: MUTED, width: 1.5, dashed: true, pulse: false })),
      accepts: () => false,
    });
  }

  return clusters;
}

/** What a drop on a cluster means, as a move. */
export function moveForDrop(map: UserAiMap, featureId: string, clusterId: string): MoveInput | null {
  const f = map.features.find((x) => x.id === featureId);
  if (!f) return null;
  if (clusterId === "included") return { feature: f.id, lane: "included", done: `${f.label} now runs on Included` };
  if (clusterId === "assistant") return { feature: f.id, lane: "assistant", done: `${f.label} now runs in your assistant` };
  if (clusterId === "off") return { feature: f.id, lane: "off", done: `${f.label} is off` };
  if (clusterId.startsWith("key:")) {
    const k = map.keys.find((x) => `key:${x.id}` === clusterId);
    if (!k) return null;
    // Same provider keeps a pinned model; a different one starts on its default.
    const keep = f.lane === "byok" && f.provider === k.provider && f.pinnedModel ? f.model : null;
    return { feature: f.id, lane: "byok", keyId: k.id, model: keep, done: `${f.label} now runs on ${k.name}` };
  }
  return null;
}
