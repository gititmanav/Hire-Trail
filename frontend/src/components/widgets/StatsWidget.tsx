import type { ReactNode } from "react";
import type { AnalyticsData, Stage } from "../../types";

interface Props {
  data: AnalyticsData;
}

type Trend = "up" | "down" | "flat" | null;

function weekOverWeekTrend(weeklyTrend: AnalyticsData["weeklyTrend"]): { recent: number; prev: number; trend: Trend } {
  if (!weeklyTrend?.length) return { recent: 0, prev: 0, trend: null };
  const sorted = [...weeklyTrend].sort((a, b) => new Date(a.firstDate).getTime() - new Date(b.firstDate).getTime());
  const recent = sorted[sorted.length - 1]?.count ?? 0;
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2]!.count : 0;
  if (sorted.length < 2) return { recent, prev, trend: null };
  if (recent > prev) return { recent, prev, trend: "up" };
  if (recent < prev) return { recent, prev, trend: "down" };
  return { recent, prev, trend: "flat" };
}

function TrendGlyph({ trend }: { trend: Trend }) {
  if (!trend) return null;
  const cls =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`} title="vs prior week (new applications)">
      {trend === "up" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )}
      {trend === "down" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      )}
      {trend === "flat" && <span className="text-muted-foreground">—</span>}
      <span className="sr-only">{trend === "up" ? "Up vs prior week" : trend === "down" ? "Down vs prior week" : "Flat vs prior week"}</span>
    </span>
  );
}

export default function StatsWidget({ data }: Props) {
  const { funnel: f, total, weeklyTrend } = data;
  const active = total - (f["Rejected" as Stage] || 0);
  const inPipeline = (f["OA" as Stage] || 0) + (f["Interview" as Stage] || 0);
  const offers = f["Offer" as Stage] || 0;
  const responsePct = active > 0 ? Math.round(((inPipeline + offers) / active) * 100) : 0;

  const { trend: volTrend } = weekOverWeekTrend(weeklyTrend);

  const stats: {
    label: string;
    value: number | string;
    color: string;
    icon: ReactNode;
    trend?: Trend | null;
  }[] = [
    {
      label: "Total applications",
      value: total,
      color: "",
      trend: volTrend,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary/80">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      ),
    },
    {
      label: "In progress",
      value: inPipeline,
      color: "",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-600/90 dark:text-amber-400/90">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      label: "Offers",
      value: offers,
      color: "text-success",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-emerald-600/90 dark:text-emerald-400/90">
          <path d="M20 12v10H4V12M2 7h20v5H2V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
        </svg>
      ),
    },
    {
      label: "Response rate",
      value: `${responsePct}%`,
      color: "text-primary",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary/80">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
      {stats.map((s, i) => (
        <div key={i} className="bg-muted/50 rounded-lg p-4 flex flex-col justify-center gap-2 min-h-[92px]">
          <div className="flex items-center justify-between gap-1">
            <span className="shrink-0 opacity-90" aria-hidden>
              {s.icon}
            </span>
            {s.trend != null ? <TrendGlyph trend={s.trend} /> : null}
          </div>
          <div className={`text-2xl font-bold text-foreground leading-none ${s.color}`}>{s.value}</div>
          <div className="text-[12px] text-muted-foreground leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
