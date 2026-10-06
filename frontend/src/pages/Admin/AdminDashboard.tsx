/** Admin Dashboard — one screen of the platform, every number real.
 *  KPI strip · 30-day charts · pipeline · inbox review queue · own AI keys ·
 *  match scores · profiles · feedback · recent activity. The server leaves out
 *  deleted accounts and the demo account (routes/admin/dashboard.ts). */
import { useEffect, useMemo, useState, useContext, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import "../../utils/chartSetup";
import { chartColors, primaryColor, mutedFgColor, borderColor, paletteColor } from "../../utils/chartSetup";
import { ThemeContext } from "../../hooks/useTheme.tsx";
import PageHeader from "../../components/ui/PageHeader.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import ProviderMark from "../../components/ai/ProviderMark.tsx";
import { usd } from "../../components/ai/format.ts";
import { adminAPI } from "../../utils/api";
import { STAGES, STAGE_FAMILY, STAGE_STRIPE_CLASS } from "../../utils/stageStyles.ts";
import { SCORE_BAND_LABEL, formatScore, scoreBand, scoreBandColor, type ScoreBand } from "../../utils/matchScore.ts";
import type { AdminDashboardData, AuditLog } from "../../types";

/* ---------------- helpers ---------------- */

const actionColors: Record<string, string> = {
  login: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  create: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  suspend: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  role_change: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function userName(userId: AuditLog["userId"]): string {
  if (typeof userId === "object" && userId !== null) return userId.name;
  return "System";
}

const BANDS: ScoreBand[] = ["strong", "good", "fair"];

/* ---------------- page ---------------- */

/** The last 30 days (UTC, as the server buckets them), quiet days at zero —
 *  so one busy day is one bar, not the whole chart. */
function last30Days(rows: { _id: string; count: number }[]): { labels: string[]; counts: number[] } {
  const byDay = new Map(rows.map((r) => [r._id, r.count]));
  const labels: string[] = [];
  const counts: number[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }));
    counts.push(byDay.get(key) ?? 0);
  }
  return { labels, counts };
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export default function AdminDashboard() {
  const { revision } = useContext(ThemeContext);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then(setData)
      .catch(() => { /* the interceptor toasts */ })
      .finally(() => setLoading(false));
  }, []);

  // Canvas can't read CSS variables, so the chart config is rebuilt from the
  // live tokens whenever the theme changes (the theme class is applied during
  // the provider's render, before this runs).
  const charts = useMemo(() => {
    if (!data) return null;
    const palette = chartColors();
    const fg = mutedFgColor();
    const border = borderColor();
    const primary = primaryColor();

    const lineOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: fg, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: fg, font: { size: 10 }, precision: 0 }, grid: { color: border }, beginAtZero: true },
      },
    } as const;

    const line = (rows: { _id: string; count: number }[], label: string, color: string, fill: string) => {
      const days = last30Days(rows);
      return {
        labels: days.labels,
        datasets: [{ label, data: days.counts, borderColor: color, backgroundColor: fill, fill: true, tension: 0.3, pointRadius: 0 }],
      };
    };

    const userGrowth = line(data.charts.userGrowth, "New users", primary, primaryColor(0.13));
    const tailorPerDay = line(data.charts.tailorPerDay, "Tailoring", palette[1], chartColors(0.13)[1]);
    const aiRunsPerDay = line(data.charts.aiRunsPerDay, "AI runs", palette[3], chartColors(0.13)[3]);

    const appsDays = last30Days(data.charts.appsPerDay);
    const appsPerDay = {
      labels: appsDays.labels,
      datasets: [{
        label: "Applications added",
        data: appsDays.counts,
        backgroundColor: chartColors(0.67)[2],
        borderColor: palette[2],
        borderWidth: 1,
      }],
    };

    const stages = STAGES.filter((s) => data.tracking.applicationsByStage[s]);
    const stageBreakdown = {
      labels: stages,
      datasets: [{
        data: stages.map((s) => data.tracking.applicationsByStage[s] || 0),
        backgroundColor: stages.map((s) => paletteColor(`${STAGE_FAMILY[s]}-500`, 0.8)),
        borderColor: border,
        borderWidth: 1,
      }],
    };

    const doughnutOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" as const, labels: { color: fg, font: { size: 11 } } },
      },
    } as const;

    return { userGrowth, tailorPerDay, aiRunsPerDay, appsPerDay, stageBreakdown, lineOpts, doughnutOpts };
  }, [data, revision]);

  if (loading) return <DashboardSkeleton />;

  if (!data || !charts) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-muted-foreground py-12 text-center">The dashboard didn't load. Refresh to try again.</p>
      </div>
    );
  }

  const { users: u, tracking: t, mailboxes: m, ai, fit, inbox, feedback } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" meta="Excludes the demo account" />

      {/* ===== KPI strip ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Users" value={u.total.toLocaleString()} subValue={`${u.admins} admin · +${u.signupsThisWeek} this week`} link="/admin/users" />
        <Kpi label="Signed in · 7d" value={u.signedInThisWeek.toLocaleString()} subValue={`+${u.signupsToday} new today`} />
        <Kpi label="Applications" value={t.applications.toLocaleString()} subValue={`${plural(t.resumes, "resume")} · ${plural(t.contacts, "contact")}`} />
        <Kpi label="Inbox connected" value={m.any.toLocaleString()} subValue={`Gmail ${m.gmail}${m.outlook ? ` · Outlook ${m.outlook}` : ""}`} link="/admin/mailbox" />
        <Kpi label="Included AI spend" value={usd(ai.includedSpendUsd)} subValue={`${ai.runsThisMonth.toLocaleString()} AI runs this month`} link="/admin/ai?view=spend" />
        <Kpi label="Open feedback" value={feedback.open.toLocaleString()} subValue="In the admin inbox" highlight={feedback.open > 0} link="/admin/feedback" />
      </div>

      {/* ===== 30-day charts ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="New users (30d)" subtitle={`+${u.signupsThisMonth} in the last 30 days`}>
          <Line data={charts.userGrowth} options={charts.lineOpts} />
        </ChartCard>
        <ChartCard title="Applications added (30d)">
          <Bar data={charts.appsPerDay} options={charts.lineOpts} />
        </ChartCard>
        <ChartCard title="Tailoring (30d)" subtitle={`${fit.sessionsThisWeek} this week · ${fit.sessionsTotal.toLocaleString()} all time`}>
          <Line data={charts.tailorPerDay} options={charts.lineOpts} />
        </ChartCard>
        <ChartCard title="AI runs (30d)" subtitle={`${ai.runsThisMonth.toLocaleString()} this month`}>
          <Line data={charts.aiRunsPerDay} options={charts.lineOpts} />
        </ChartCard>
      </div>

      {/* ===== Breakdowns row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Application pipeline" subtitle="Current stage distribution">
          {t.applications === 0 ? (
            <EmptyChart label="No applications tracked yet" />
          ) : (
            <Doughnut data={charts.stageBreakdown} options={charts.doughnutOpts} />
          )}
        </ChartCard>

        <Card title="Inbox review queue" subtitle="This month, from connected inboxes">
          <InboxQueue inbox={inbox} />
        </Card>

        <Card title="People's own AI" subtitle="Their own keys and assistant connections">
          <OwnAi ai={ai} />
        </Card>
      </div>

      {/* ===== Secondary metrics row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Match scores" subtitle="Scored in the last 30 days">
          <ScoreBands fit={fit} />
        </Card>

        <Card title="Profile coverage" subtitle="Users with structured master profiles">
          <ProfileCoverage masterProfileUsers={t.masterProfileUsers} totalUsers={u.total} />
        </Card>

        <Card title="Feedback by type" subtitle="All-time inbox breakdown">
          <FeedbackBars byType={feedback.byType} />
        </Card>
      </div>

      {/* ===== Recent audit activity ===== */}
      <div className="surface-card">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
          <Link to="/admin/audit-logs" className="text-xs font-medium text-primary hover:underline">All audit logs →</Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentActivity.slice(0, 10).map((a) => (
              <li key={a._id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${actionColors[a.action] ?? "bg-control text-muted-foreground"}`}>
                    {a.action.replace(/_/g, " ")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{userName(a.userId)} · {a.resourceType}</p>
                    {a.resourceId && <p className="text-[11px] text-muted-foreground truncate font-mono">{a.resourceId}</p>}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{new Date(a.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================================================== */
/* Sub-components                                                 */
/* ============================================================== */

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[284px] rounded-xl" />)}
      </div>
    </div>
  );
}

function Kpi({ label, value, subValue, highlight, link }: { label: string; value: number | string; subValue?: string; highlight?: boolean; link?: string }) {
  const inner = (
    <div className={`border rounded-xl p-4 transition-colors h-full ${
      highlight
        ? "border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20"
        : "border-border bg-card hover:border-foreground/20"
    }`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
      {subValue && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{subValue}</p>}
    </div>
  );
  if (link) return <Link to={link} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{inner}</Link>;
  return inner;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="surface-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="surface-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{label}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground py-6 text-center">{children}</p>;
}

/** One labelled bar: label left, count (· share) right, the bar under it. */
function BarRow({ label, value, pct, fill, style }: { label: ReactNode; value: ReactNode; pct: number; fill?: string; style?: CSSProperties }) {
  return (
    <li>
      <div className="flex justify-between items-center gap-3 text-xs mb-1">
        <span className="text-foreground min-w-0 truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">{value}</span>
      </div>
      <div className="h-1.5 bg-control rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${fill ?? ""}`} style={{ width: `${pct}%`, ...style }} />
      </div>
    </li>
  );
}

/** Three quiet figures in a row (the queue's found / imported / merged). */
function Figures({ items }: { items: [string, number][] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {items.map(([label, n]) => (
        <div key={label} className="rounded-lg bg-control/60 px-2.5 py-2 min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold text-foreground tabular-nums leading-tight mt-0.5">{n.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function InboxQueue({ inbox }: { inbox: AdminDashboardData["inbox"] }) {
  const added = inbox.importedThisMonth + inbox.mergedThisMonth;
  if (inbox.foundThisMonth === 0 && added === 0) return <Empty>No inbox scans this month.</Empty>;
  return (
    <>
      <Figures items={[["Found", inbox.foundThisMonth], ["Imported", inbox.importedThisMonth], ["Merged", inbox.mergedThisMonth]]} />
      {added === 0 ? (
        <Empty>Nothing imported or merged yet.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {STAGES.filter((s) => inbox.addedByStage[s]).map((s) => {
            const v = inbox.addedByStage[s];
            return <BarRow key={s} label={s} value={v} pct={Math.round((v / added) * 100)} fill={STAGE_STRIPE_CLASS[s]} />;
          })}
        </ul>
      )}
    </>
  );
}

function OwnAi({ ai }: { ai: AdminDashboardData["ai"] }) {
  const rows = ai.ownKeysByProvider;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <>
      <Figures items={[["Own key", ai.ownKeyUsers], ["Keys", rows.reduce((n, r) => n + r.count, 0)], ["Assistants", ai.assistantConnections]]} />
      {rows.length === 0 ? (
        <Empty>No one has added their own key yet.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <BarRow
              key={r.provider}
              label={<span className="inline-flex items-center gap-1.5"><ProviderMark provider={r.provider} size={16} />{r.label}</span>}
              value={`${r.count} ${r.count === 1 ? "key" : "keys"}`}
              pct={(r.count / max) * 100}
              fill="bg-primary"
            />
          ))}
        </ul>
      )}
    </>
  );
}

function ScoreBands({ fit }: { fit: AdminDashboardData["fit"] }) {
  if (fit.scored30d === 0) return <Empty>No scored applications in the last 30 days.</Empty>;
  const byBand: Record<ScoreBand, number> = { strong: 0, good: 0, fair: 0 };
  for (const [bucket, n] of Object.entries(fit.scoreBuckets)) byBand[scoreBand(Number(bucket))] += n;
  return (
    <>
      <p className="text-xs text-muted-foreground mb-3">
        Average <span className="text-foreground font-semibold tabular-nums">{fit.avgMatchScore != null ? formatScore(fit.avgMatchScore) : "—"}</span> / 10
        {" · "}{fit.scored30d.toLocaleString()} scored
      </p>
      <ul className="space-y-2.5">
        {BANDS.map((b) => {
          const v = byBand[b];
          const pct = Math.round((v / fit.scored30d) * 100);
          return <BarRow key={b} label={SCORE_BAND_LABEL[b]} value={`${v} · ${pct}%`} pct={pct} style={{ background: scoreBandColor(b) }} />;
        })}
      </ul>
    </>
  );
}

function ProfileCoverage({ masterProfileUsers, totalUsers }: { masterProfileUsers: number; totalUsers: number }) {
  const pct = totalUsers > 0 ? Math.round((masterProfileUsers / totalUsers) * 100) : 0;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-3xl font-bold text-foreground tabular-nums">{masterProfileUsers}</p>
        <p className="text-xs text-muted-foreground mt-0.5">of {totalUsers} users have built a master profile</p>
      </div>
      <div className="h-2 bg-control rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{pct}% adoption</p>
    </div>
  );
}

function FeedbackBars({ byType }: { byType: Record<string, number> }) {
  const types = [
    { key: "bug", label: "Bugs", tone: "bg-red-500" },
    { key: "suggestion", label: "Suggestions", tone: "bg-blue-500" },
    { key: "idea", label: "Ideas", tone: "bg-amber-500" },
    { key: "praise", label: "Praise", tone: "bg-emerald-500" },
    { key: "other", label: "Other", tone: "bg-gray-400" },
  ];
  const total = types.reduce((s, t) => s + (byType[t.key] || 0), 0);
  if (total === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-muted-foreground">No feedback yet.</p>
        <Link to="/admin/feedback" className="inline-block mt-2 text-xs font-medium text-primary hover:underline">Open inbox →</Link>
      </div>
    );
  }
  return (
    <ul className="space-y-2.5">
      {types.map((t) => {
        const v = byType[t.key] || 0;
        const pct = Math.round((v / total) * 100);
        return <BarRow key={t.key} label={t.label} value={`${v} · ${pct}%`} pct={pct} fill={t.tone} />;
      })}
    </ul>
  );
}
