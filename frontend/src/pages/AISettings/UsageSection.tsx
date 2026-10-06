/** This month on My AI: the Included allowance, and what each feature used. */
import { LANE_LABEL, type AiLane, type UserAiMap } from "../../utils/aiApi.ts";
import { count, shortDate, usd } from "../../components/ai/format.ts";
import FeatureGlyph from "../../components/ai/FeatureGlyph.tsx";

export default function UsageSection({ map }: { map: UserAiMap }) {
  const { usage, features } = map;
  const { spentUsd, allowanceUsd } = usage.included;
  const pct = allowanceUsd > 0 ? Math.min(100, (spentUsd / allowanceUsd) * 100) : 0;
  const near = pct >= 80;
  const rows = usage.byFeature.filter((r) => r.calls > 0);

  return (
    <div className="surface-card divide-y divide-border overflow-hidden">
      {map.policy.lanes.included && (
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Included AI</p>
            <p className="text-[12.5px] text-muted-foreground tabular-nums">
              {allowanceUsd > 0 ? `${usd(spentUsd)} of ${usd(allowanceUsd)}` : usd(spentUsd)} · resets {shortDate(usage.resetsAt)}
            </p>
          </div>
          {allowanceUsd > 0 && (
            <div
              className="mt-2.5 h-1.5 rounded-full bg-control overflow-hidden"
              role="progressbar"
              aria-label="Included AI used this month"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <div className={`h-full rounded-full transition-[width] duration-500 ${near ? "bg-amber-500" : "bg-foreground/70"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
            {near
              ? "You're close to this month's included AI. Your own key or your assistant keep everything running."
              : "HireTrail pays for this. Your own key or your assistant have no monthly limit."}
          </p>
        </div>
      )}

      {rows.length ? (
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-foreground mb-2.5">By feature</p>
          <ul className="space-y-2">
            {rows.map((r) => {
              const f = features.find((x) => x.id === r.feature);
              const where = Object.entries(r.lane)
                .sort((a, b) => b[1] - a[1])
                .map(([l]) => LANE_LABEL[l as AiLane] ?? l)
                .join(", ");
              return (
                <li key={r.feature} className="flex items-center gap-3 text-[13px]">
                  <span className="w-6 h-6 shrink-0 grid place-items-center rounded-md bg-control text-foreground/70">
                    <FeatureGlyph icon={f?.icon ?? ""} size={13} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{f?.label ?? r.feature}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {count(r.calls, "run")}{r.failures ? ` · ${r.failures} failed` : ""}
                  </span>
                  <span className="hidden sm:inline text-muted-foreground shrink-0 w-28 truncate text-right">{where}</span>
                  <span className="text-foreground tabular-nums shrink-0 w-14 text-right">{usd(r.costUsd)}</span>
                </li>
              );
            })}
          </ul>
          {usage.totals.byokCostUsd > 0 && (
            <p className="text-[12px] text-muted-foreground mt-3">
              About {usd(usage.totals.byokCostUsd)} of that ran on your own keys — your provider bills it, not HireTrail.
            </p>
          )}
        </div>
      ) : (
        <div className="px-5 py-4">
          <p className="text-[13px] text-muted-foreground">No AI used yet this month.</p>
        </div>
      )}
    </div>
  );
}
