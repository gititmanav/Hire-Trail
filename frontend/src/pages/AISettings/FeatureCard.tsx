/** A feature's card on My AI's map: what it does, where it runs, and — the
 *  keyboard/touch alternative to dragging — where to move it, which of your
 *  keys and which model. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import Select from "../../components/ui/Select.tsx";
import Button from "../../components/ui/Button.tsx";
import FeatureGlyph from "../../components/ai/FeatureGlyph.tsx";
import ProviderMark from "../../components/ai/ProviderMark.tsx";
import { count, sinceLabel } from "../../components/ai/format.ts";
import { aiApi, LANE_LABEL, type AiLane, type AiMapFeature, type UserAiMap } from "../../utils/aiApi.ts";
import type { MoveInput } from "./useMyAi.ts";

const LOCK_COPY: Record<NonNullable<AiMapFeature["lock"]>, string> = {
  admin_feature: "HireTrail sets where this runs.",
  admin_user: "HireTrail has set where AI runs for your account.",
  map_off: "HireTrail sets where AI runs right now.",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{children}</span>
    </div>
  );
}

export default function FeatureCard({ f, map, onMove, onReset, busy }: {
  f: AiMapFeature;
  map: UserAiMap;
  onMove: (m: MoveInput) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const key = f.lane === "byok" ? map.keys.find((k) => k.id === f.keyId) ?? null : null;
  const locked = !!f.lock;
  const lanes = f.choosable.filter((l) => l !== "byok" || map.keys.length > 0);

  // The model list for the key it runs on (live from the provider, cached).
  const models = useQuery({
    queryKey: ["ai", "models", key?.id],
    queryFn: () => aiApi.models(key!.id),
    enabled: !!key && !locked,
    staleTime: 10 * 60_000,
    retry: false,
    // The card says what went wrong, in place — no second message as a toast.
    meta: { silent: true },
  });
  const [model, setModel] = useState(f.model ?? "");
  useEffect(() => setModel(f.model ?? ""), [f.model]);

  const moveTo = (lane: AiLane) => {
    if (lane === f.lane) return;
    onMove({ feature: f.id, lane, done: `${f.label} now runs ${lane === "off" ? "nowhere — it's off" : `on ${LANE_LABEL[lane]}`}` });
  };

  const usedLine = f.activity.calls7d
    ? `${count(f.activity.calls7d, "run")}${f.activity.failures7d ? ` · ${f.activity.failures7d} failed` : ""}`
    : "Not used this week";

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-7 h-7 shrink-0 grid place-items-center rounded-lg bg-control text-foreground/80">
          <FeatureGlyph icon={f.icon} size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground leading-snug">{f.label}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{f.description}</p>
        </div>
      </div>

      {f.refusal && (
        <p className="text-[12px] leading-relaxed text-red-600 dark:text-red-400">{f.refusal.message}</p>
      )}

      <div className="space-y-1">
        <Fact label="Runs on">
          {f.lane === "included" && (map.included.providerLabel ? `Included · ${map.included.providerLabel}` : "Included")}
          {f.lane === "byok" && (key ? (
            <span className="inline-flex items-center gap-1.5"><ProviderMark provider={key.provider} size={14} />{key.name}{!f.pinnedKey && <span className="text-muted-foreground"> · default</span>}</span>
          ) : "Your key")}
          {f.lane === "assistant" && (map.assistant.connected ? "Your assistant" : "Your assistant · not connected")}
          {f.lane === "off" && "Off"}
          {!f.lane && "Paused"}
        </Fact>
        {f.model && (f.lane === "included" || f.lane === "byok") && (
          <Fact label="Model"><code className="font-mono text-[11.5px]">{f.model}</code></Fact>
        )}
        <Fact label="This week">{usedLine}</Fact>
        {f.activity.lastAt && <Fact label="Last run">{sinceLabel(f.activity.lastAt)}</Fact>}
      </div>

      {f.lane === "off" && f.offMeans && <p className="text-[12px] text-muted-foreground leading-relaxed">{f.offMeans}</p>}
      {f.lane === "assistant" && (
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          It waits until you ask your assistant — in Claude Code, “do my HireTrail AI tasks”.
        </p>
      )}

      {locked ? (
        <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-3">
          <Lock size={12} strokeWidth={2} className="mt-[2px] shrink-0" aria-hidden />
          {LOCK_COPY[f.lock!]}
        </p>
      ) : lanes.length > 1 && (
        <div className="space-y-2.5 border-t border-border pt-3">
          <div>
            <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Run it on</p>
            <SegmentedControl<AiLane>
              size="sm"
              ariaLabel={`Where ${f.label} runs`}
              value={(f.lane ?? lanes[0]) as AiLane}
              onChange={moveTo}
              segments={lanes.map((l) => ({ value: l, label: LANE_LABEL[l] }))}
            />
          </div>

          {f.lane === "byok" && map.keys.length > 1 && (
            <div>
              <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Key</p>
              <Select
                size="sm"
                ariaLabel="Key"
                value={key?.id ?? ""}
                onChange={(id) => {
                  const next = map.keys.find((k) => k.id === id);
                  onMove({ feature: f.id, lane: "byok", keyId: id, done: next ? `${f.label} now runs on ${next.name}` : undefined });
                }}
                options={map.keys
                  // Email never goes to a free-tier key (unless HireTrail allows it).
                  .filter((k) => !(k.freeTier && f.dataClass === "email" && !map.policy.freeTierKeysForEmail))
                  .map((k) => ({
                    value: k.id,
                    label: k.name,
                    description: `${k.providerLabel} · ••••${k.last4}`,
                    icon: <ProviderMark provider={k.provider} size={16} />,
                  }))}
              />
            </div>
          )}

          {f.lane === "byok" && key && (
            <div>
              <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Model</p>
              {models.isError ? (
                <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">
                  Couldn't fetch this key's models. Check the key in the list below.
                </p>
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
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy}
                    onClick={() => onMove({ feature: f.id, lane: "byok", keyId: key.id, model, done: `${f.label} now uses ${model}` })}
                  >
                    Use this model
                  </Button>
                )}
                {f.pinnedModel && (
                  <Button size="sm" variant="ghost" onClick={() => onMove({ feature: f.id, lane: "byok", keyId: key.id, model: null, done: `${f.label} uses its default model again` })}>
                    Use the default model
                  </Button>
                )}
              </div>
            </div>
          )}

          {f.userChoice && (
            <button
              type="button"
              onClick={onReset}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Back to the default ({LANE_LABEL[f.defaultLane]})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
