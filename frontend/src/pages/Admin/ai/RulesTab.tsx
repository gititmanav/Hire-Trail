/** Admin → AI → Rules. What people may do with AI, from the master switch
 *  down to one feature: on/off, which lanes people may pick, a lane everyone
 *  is put on, the default lane, and how many Included runs a month. Each
 *  change saves on its own and is audit-logged. */
import { useEffect, useState } from "react";
import toast from "../../../components/ui/toast.ts";

import Toggle from "../../../components/ui/Toggle.tsx";
import Select from "../../../components/ui/Select.tsx";
import { Input, Textarea } from "../../../components/ui/Field.tsx";
import Button from "../../../components/ui/Button.tsx";
import FeatureGlyph from "../../../components/ai/FeatureGlyph.tsx";
import { SettingsCard, SettingsRow, SettingsSection } from "../../Settings/ui.tsx";
import { LANE_LABEL, type AdminAiFeature, type AdminAiMap, type AiFeatureRule, type AiLane, type AiSettingsPatch } from "../../../utils/aiApi.ts";
import { useUpdateAiSettings, useUpdateFeatureRule } from "./useAdminAi.ts";

/** A number field that saves on blur / Enter, and only when it changed. */
function NumberSetting({ value, onSave, min = 0, step = 1, suffix, ariaLabel, width = "w-24" }: {
  value: number;
  onSave: (n: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  ariaLabel: string;
  width?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < min) { setDraft(String(value)); return; }
    if (n !== value) onSave(n);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${width} shrink-0`}>
        <Input
          aria-label={ariaLabel}
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-8 text-right tabular-nums"
          step={step}
        />
      </span>
      {suffix && <span className="text-[12.5px] text-muted-foreground">{suffix}</span>}
    </span>
  );
}

function LanePills({ lanes, allowed, forced, onToggle }: {
  lanes: AiLane[];
  allowed: AiLane[];
  forced: AiLane | null;
  onToggle: (lane: AiLane) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lanes people may choose">
      {lanes.map((l) => {
        const on = allowed.includes(l);
        const locked = forced === l; // a forced lane is always allowed
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            disabled={locked || (on && allowed.length === 1)}
            onClick={() => onToggle(l)}
            title={locked ? "Everyone is put on this lane" : on && allowed.length === 1 ? "At least one lane stays allowed" : undefined}
            className={`h-7 px-2.5 rounded-md text-[12px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
              on ? "bg-control border-foreground/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {LANE_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}

function FeatureRuleCard({ f, onSave, highlighted }: { f: AdminAiFeature; onSave: (patch: Partial<AiFeatureRule>) => void; highlighted: boolean }) {
  const r = f.rule;
  return (
    <div id={`rule-${f.id}`} className={`px-5 py-4 transition-colors ${highlighted ? "bg-control/50" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-control text-foreground/80">
            <FeatureGlyph icon={f.icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{f.label}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed max-w-xl">{f.description}</p>
          </div>
        </div>
        <Toggle checked={r.enabled} onChange={(v) => onSave({ enabled: v })} label={`${f.label} on for everyone`} />
      </div>

      {r.enabled && (
        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 sm:pl-11">
          <div>
            <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">People may choose</p>
            <LanePills
              lanes={f.lanes}
              allowed={r.allowedLanes}
              forced={r.forcedLane}
              onToggle={(l) => {
                const next = r.allowedLanes.includes(l) ? r.allowedLanes.filter((x) => x !== l) : [...r.allowedLanes, l];
                onSave({ allowedLanes: next });
              }}
            />
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Put everyone on</p>
            <Select
              size="sm"
              ariaLabel="Put everyone on"
              value={r.forcedLane ?? ""}
              onChange={(v) => onSave({ forcedLane: (v || null) as AiLane | null })}
              options={[
                { value: "", label: "No — people choose", description: "Within the lanes allowed" },
                ...f.lanes.map((l) => ({ value: l, label: LANE_LABEL[l], description: l === "byok" ? "Their own key — no key, no feature" : l === "assistant" ? "Their connected assistant" : undefined })),
              ]}
            />
          </div>
          {!r.forcedLane && (
            <div>
              <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Default for new people</p>
              <Select
                size="sm"
                ariaLabel="Default lane"
                value={r.defaultLane}
                onChange={(v) => onSave({ defaultLane: v as AiLane })}
                options={r.allowedLanes.map((l) => ({ value: l, label: LANE_LABEL[l] }))}
              />
            </div>
          )}
          {f.lanes.includes("included") && (
            <div>
              <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">Included runs per person, per month</p>
              <NumberSetting
                ariaLabel={`${f.label}: included runs per month`}
                value={r.includedMonthlyLimit}
                onSave={(n) => onSave({ includedMonthlyLimit: Math.floor(n) })}
                suffix="runs"
              />
              <p className="text-[11.5px] text-muted-foreground mt-1">0 = no count limit; the money allowance still applies.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RulesTab({ map, focusFeature }: { map: AdminAiMap; focusFeature: string | null }) {
  const settings = useUpdateAiSettings();
  const rule = useUpdateFeatureRule();
  const p = map.policy;
  const [pause, setPause] = useState(p.pauseMessage);
  useEffect(() => setPause(p.pauseMessage), [p.pauseMessage]);

  const save = (patch: AiSettingsPatch, done?: string) =>
    settings.mutate(patch, { onSuccess: () => { if (done) toast.success(done); } });

  useEffect(() => {
    if (focusFeature) document.getElementById(`rule-${focusFeature}`)?.scrollIntoView({ block: "center" });
  }, [focusFeature]);

  return (
    <div className="space-y-8">
      <SettingsSection title="Everyone" description="Platform-wide switches. They apply within 30 seconds.">
        <SettingsCard>
          <SettingsRow
            title="AI"
            description={p.aiEnabled ? "On. Turn it off to pause every AI feature for everyone — the rest of HireTrail keeps working." : "Paused for everyone. People see the message below."}
          >
            <Toggle checked={p.aiEnabled} onChange={(v) => save({ aiEnabled: v }, v ? "AI is on" : "AI is paused for everyone")} label="AI on for everyone" />
          </SettingsRow>
          <SettingsRow title="Message while paused" description="Shown wherever AI would have run. Leave empty for the standard sentence." stack>
            <Textarea
              rows={2}
              maxLength={280}
              value={pause}
              onChange={(e) => setPause(e.target.value)}
              placeholder="AI is paused on HireTrail right now."
            />
            {pause !== p.pauseMessage && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="primary" onClick={() => save({ pauseMessage: pause }, "Message saved")}>Save message</Button>
              </div>
            )}
          </SettingsRow>
          <SettingsRow
            title="People choose where AI runs"
            description={p.userMapEnabled ? "Everyone can move features on their own AI map, within the rules below." : "Maps are read-only — every feature runs on its default lane (or the lane you put everyone on)."}
          >
            <Toggle checked={p.userMapEnabled} onChange={(v) => save({ userMapEnabled: v }, v ? "People can choose again" : "Maps are now read-only")} label="People choose where AI runs" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Lanes" description="Switch a lane off and every feature on it moves to its next allowed lane.">
        <SettingsCard>
          <SettingsRow title="Included" description="HireTrail's own keys, paid by HireTrail within the budget.">
            <Toggle checked={p.lanes.included} onChange={(v) => save({ lanes: { included: v } })} label="Included lane" />
          </SettingsRow>
          <SettingsRow title="My key" description="People's own provider keys — they pay their provider.">
            <Toggle checked={p.lanes.byok} onChange={(v) => save({ lanes: { byok: v } })} label="My key lane" />
          </SettingsRow>
          <SettingsRow title="My assistant" description="People's own AI assistant over MCP, on their subscription.">
            <Toggle checked={p.lanes.assistant} onChange={(v) => save({ lanes: { assistant: v } })} label="Assistant lane" />
          </SettingsRow>
          <SettingsRow title="Free-tier keys may receive email" description="Off by default: free tiers can let the provider use what they receive. When off, inbox sorting never runs on a free-tier key.">
            <Toggle checked={p.freeTierKeysForEmail} onChange={(v) => save({ freeTierKeysForEmail: v })} label="Free-tier keys may receive email" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Features" description="Per feature: whether it runs at all, where people may run it, and its share of the Included budget.">
        <div className="surface-card divide-y divide-border overflow-hidden">
          {map.features.map((f) => (
            <FeatureRuleCard
              key={f.id}
              f={f}
              highlighted={focusFeature === f.id}
              onSave={(patch) => rule.mutate({ feature: f.id, patch }, { onSuccess: () => toast.success(`${f.label} updated`) })}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Assistant connections (MCP)" description="People connect Claude Code and other assistants with a personal token.">
        <SettingsCard>
          <SettingsRow title="Allow connections" description="Off: every connection stops working at once (tokens are kept).">
            <Toggle checked={p.mcp.enabled} onChange={(v) => save({ mcp: { enabled: v } })} label="Allow assistant connections" />
          </SettingsRow>
          <SettingsRow title="Allow changes" description="Off: assistants can read and do AI tasks, but can't add or change anything.">
            <Toggle checked={p.mcp.writeToolsEnabled} onChange={(v) => save({ mcp: { writeToolsEnabled: v } })} label="Allow changes from assistants" />
          </SettingsRow>
          <SettingsRow title="Calls per hour" description="Per connection.">
            <NumberSetting ariaLabel="Calls per hour" min={1} value={p.mcp.callsPerHour} onSave={(n) => save({ mcp: { callsPerHour: Math.floor(n) } }, "Saved")} />
          </SettingsRow>
          <SettingsRow title="Changes per hour" description="Per connection; 0 = none.">
            <NumberSetting ariaLabel="Changes per hour" value={p.mcp.writesPerHour} onSave={(n) => save({ mcp: { writesPerHour: Math.floor(n) } }, "Saved")} />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
