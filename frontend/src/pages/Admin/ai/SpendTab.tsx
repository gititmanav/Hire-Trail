/** Admin → AI → Spend. The Included budget (a hard monthly cap, what one
 *  person may spend, when to be told) and this month's lens: spend by day,
 *  by feature, by model, what failed and what was refused, and who spends
 *  most — each person one click from their override. */
import { useEffect, useState } from "react";
import toast from "../../../components/ui/toast.ts";

import { Input } from "../../../components/ui/Field.tsx";
import FeatureGlyph from "../../../components/ai/FeatureGlyph.tsx";
import { count, shortDate, usd } from "../../../components/ai/format.ts";
import { SettingsCard, SettingsRow, SettingsSection } from "../../Settings/ui.tsx";
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";
import { LANE_LABEL, type AdminAiMap, type AiLane } from "../../../utils/aiApi.ts";
import { useAdminAiUsage, useUpdateAiSettings } from "./useAdminAi.ts";
import UserAiModal from "./UserAiModal.tsx";

const ERROR_WORDS: Record<string, string> = {
  disabled: "Switched off", off: "Turned off by the person", not_allowed: "Not allowed", no_route: "No key set up",
  needs_key: "No key of their own", assistant_lane: "Runs in their assistant", limit_reached: "Allowance used up",
  feature_limit: "Feature limit reached", cap_reached: "Monthly cap reached", auth: "Key rejected", quota: "Provider out of credit",
  rate_limit: "Provider busy", provider_down: "Provider didn't answer", bad_request: "Provider refused the request",
  unsupported: "Model can't do it", parse: "Unreadable answer", timeout: "Took too long", aborted: "Stopped",
};

function UsdSetting({ value, onSave, ariaLabel }: { value: number; onSave: (n: number) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => setDraft(value.toFixed(2)), [value]);
  const commit = () => {
    const n = Number(draft.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) { setDraft(value.toFixed(2)); return; }
    if (Math.abs(n - value) > 0.0001) onSave(Math.round(n * 100) / 100);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[13px] text-muted-foreground">$</span>
      <span className="w-24 shrink-0">
        <Input
          aria-label={ariaLabel}
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-8 text-right tabular-nums"
        />
      </span>
    </span>
  );
}

/** Every day of the month so far (UTC, like the period), quiet days included. */
function monthDays(period: string, data: { day: string; costUsd: number; calls: number }[]) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const [y, m] = period.split("-").map(Number);
  const now = new Date();
  const thisMonth = now.getUTCFullYear() === y && now.getUTCMonth() + 1 === m;
  const last = thisMonth ? now.getUTCDate() : new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => {
    const day = `${period}-${String(i + 1).padStart(2, "0")}`;
    return byDay.get(day) ?? { day, costUsd: 0, calls: 0 };
  });
}

/** Spend per day — quiet bars, the busiest day full height; a day with no
 *  Included spend is a hairline, so the month's shape still reads. */
function DailyBars({ period, data }: { period: string; data: { day: string; costUsd: number; calls: number }[] }) {
  const days = monthDays(period, data);
  const max = Math.max(...days.map((d) => d.costUsd), 0.0001);
  return (
    <div className="flex items-end gap-[3px] h-16" role="img" aria-label="Included spend by day this month">
      {days.map((d) => (
        <div
          key={d.day}
          className={`flex-1 rounded-sm ${d.costUsd > 0 ? "bg-foreground/60" : "bg-control"}`}
          style={{ height: d.costUsd > 0 ? `${Math.max(8, (d.costUsd / max) * 100)}%` : "2px" }}
          title={`${shortDate(`${d.day}T00:00:00Z`)} · ${usd(d.costUsd)} · ${count(d.calls, "call")}`}
        />
      ))}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { code: string; n: number }[] }) {
  if (!rows.length) return null;
  return (
    <div className="px-5 py-4">
      <p className="text-sm font-medium text-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.code} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-foreground">{ERROR_WORDS[r.code] ?? r.code}</span>
            <span className="text-muted-foreground tabular-nums">{r.n.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SpendTab({ map }: { map: AdminAiMap }) {
  const usage = useAdminAiUsage();
  const settings = useUpdateAiSettings();
  const [user, setUser] = useState<{ id: string; label: string } | null>(null);
  const b = map.policy.budget;
  const u = usage.data;
  const pct = u && u.capUsd > 0 ? Math.min(100, (u.includedSpentUsd / u.capUsd) * 100) : 0;
  const label = (id: string) => map.features.find((f) => f.id === id)?.label ?? (id === "other" ? "Other" : id);

  const saveBudget = (patch: Partial<typeof b>) =>
    settings.mutate({ budget: patch }, { onSuccess: () => toast.success("Budget saved") });

  return (
    <div className="space-y-8">
      <SettingsSection title="Budget" description="Only Included spends HireTrail's money. People's own keys and assistants don't count.">
        <SettingsCard>
          <div className="px-5 py-4">
            {u ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">This month</p>
                  <p className="text-[12.5px] text-muted-foreground tabular-nums">
                    {usd(u.includedSpentUsd)} of {usd(u.capUsd)} · resets {shortDate(u.resetsAt)}
                  </p>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-control overflow-hidden" role="progressbar" aria-label="Included spend this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <div className={`h-full rounded-full ${pct >= 80 ? "bg-amber-500" : "bg-foreground/70"}`} style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
          </div>
          <SettingsRow title="Monthly cap" description="Included stops for everyone once it's reached, until the 1st. 0 switches Included off.">
            <UsdSetting ariaLabel="Monthly cap in dollars" value={b.monthlyCapUsd} onSave={(n) => saveBudget({ monthlyCapUsd: n })} />
          </SettingsRow>
          <SettingsRow title="Per person, per month" description="What one person may spend on Included. 0 = no per-person limit (the cap still applies).">
            <UsdSetting ariaLabel="Per-person allowance in dollars" value={b.perUserAllowanceUsd} onSave={(n) => saveBudget({ perUserAllowanceUsd: n })} />
          </SettingsRow>
          <SettingsRow title="Tell admins at" description="A notification as spend passes each share of the cap, once a month.">
            <div className="flex items-center gap-1.5">
              {[50, 80, 100].map((t) => {
                const on = b.alertAtPct.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => saveBudget({ alertAtPct: on ? b.alertAtPct.filter((x) => x !== t) : [...b.alertAtPct, t].sort((x, y) => x - y) })}
                    className={`h-7 px-2.5 rounded-md text-[12px] font-medium border tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on ? "bg-control border-foreground/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}%
                  </button>
                );
              })}
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="This month" description="Every call is a row — refusals and cache hits too.">
        {usage.isPending ? (
          <div className="surface-card p-5 space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : !u ? (
          <div className="surface-card px-5 py-5 text-sm text-muted-foreground">Couldn't load this month's spend.</div>
        ) : (
          <div className="surface-card divide-y divide-border overflow-hidden">
            {u.daily.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-foreground mb-3">Included spend by day</p>
                <DailyBars period={u.period} data={u.daily} />
              </div>
            )}

            <div className="px-5 py-4">
              <p className="text-sm font-medium text-foreground mb-2.5">By feature</p>
              {u.features.length ? (
                <ul className="space-y-2">
                  {u.features.map((r) => {
                    const f = map.features.find((x) => x.id === r.feature);
                    const where = Object.entries(r.lanes).sort((a, c) => c[1] - a[1]).map(([l, n]) => `${LANE_LABEL[l as AiLane] ?? l} ${n}`).join(" · ");
                    return (
                      <li key={r.feature} className="flex items-center gap-3 text-[13px]">
                        <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md bg-control text-foreground/70"><FeatureGlyph icon={f?.icon ?? ""} size={13} /></span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{label(r.feature)}</span>
                        <span className="hidden md:inline text-muted-foreground truncate max-w-[14rem]">{where}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {count(r.calls, "call")}{r.failures ? ` · ${r.failures} failed` : ""}{r.refusals ? ` · ${r.refusals} refused` : ""}
                        </span>
                        {/* Only Included is HireTrail's money; a feature that only ran on people's own keys has none. */}
                        <span className="text-foreground tabular-nums shrink-0 w-16 text-right">{r.lanes.included ? usd(r.costUsd) : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">No AI used yet this month.</p>
              )}
            </div>

            {u.providers.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-foreground mb-2.5">By model</p>
                <ul className="space-y-1.5">
                  {u.providers.slice(0, 12).map((p) => (
                    <li key={`${p.provider}|${p.model}`} className="flex items-center gap-3 text-[13px]">
                      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">{p.provider}/{p.model}</code>
                      <span className="text-muted-foreground tabular-nums shrink-0">{count(p.calls, "call")}{p.failures ? ` · ${p.failures} failed` : ""}</span>
                      <span className="text-foreground tabular-nums shrink-0 w-16 text-right">{usd(p.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Breakdown title="What failed" rows={u.failures} />
            <Breakdown title="What was refused" rows={u.refusals} />

            {u.topUsers.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-foreground mb-2.5">Most Included spend</p>
                <ul className="space-y-1">
                  {u.topUsers.map((p) => (
                    <li key={p.userId}>
                      <button
                        type="button"
                        onClick={() => setUser({ id: p.userId, label: p.name || p.email })}
                        className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 text-left text-[13px] hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">{p.name || p.email}<span className="text-muted-foreground"> · {p.email}</span></span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{count(p.calls, "call")}</span>
                        <span className="text-foreground tabular-nums shrink-0 w-16 text-right">{usd(p.costUsd)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SettingsSection>

      {user && <UserAiModal userId={user.id} label={user.label} onClose={() => setUser(null)} />}
    </div>
  );
}
