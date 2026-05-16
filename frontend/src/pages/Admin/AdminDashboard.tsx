/** Admin Dashboard — comprehensive single-screen snapshot of the platform.
 *  KPI strip · pipeline funnel · integration health · tailor/profile metrics · feedback · recent activity. */
import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import "../../utils/chartSetup";
import { chartColors, primaryColor, mutedFgColor, borderColor } from "../../utils/chartSetup";
import { ThemeContext } from "../../App.tsx";
import { adminAPI } from "../../utils/api";
import type { AdminDashboardData, AuditLog } from "../../types";
import type { Chart as ChartJS } from "chart.js";

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

const STAGE_ORDER = ["Applied", "OA", "Interview", "Offer", "Rejected"] as const;
const SIGNAL_LABELS: Record<string, string> = {
  interview_detected: "Interview",
  offer_detected: "Offer",
  rejection_detected: "Rejection",
  follow_up_detected: "Follow-up",
};

/* ---------------- page ---------------- */

export default function AdminDashboard() {
  const { themeId } = useContext(ThemeContext);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const userGrowthRef = useRef<ChartJS<"line">>(null);
  const tailorPerDayRef = useRef<ChartJS<"line">>(null);
  const appsPerDayRef = useRef<ChartJS<"bar">>(null);
  const stageRef = useRef<ChartJS<"doughnut">>(null);

  useEffect(() => {
    adminAPI.getDashboard()
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  // Re-tint charts on theme change.
  useEffect(() => {
    const palette = chartColors();
    const refs = [userGrowthRef.current, tailorPerDayRef.current, appsPerDayRef.current, stageRef.current];
    refs.forEach((c) => {
      if (!c) return;
      c.data.datasets.forEach((ds, i) => {
        ds.borderColor = palette[i % palette.length];
        if (Array.isArray(ds.backgroundColor)) {
          ds.backgroundColor = ds.backgroundColor.map((_, j) => palette[j % palette.length] + "55");
        } else {
          ds.backgroundColor = palette[i % palette.length] + "33";
        }
      });
      c.update();
    });
  }, [themeId]);

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
        y: { ticks: { color: fg, font: { size: 10 } }, grid: { color: border } },
      },
    } as const;

    const userGrowth = {
      labels: data.charts.userGrowth.map((d) => d._id),
      datasets: [{
        label: "New users",
        data: data.charts.userGrowth.map((d) => d.count),
        borderColor: primary,
        backgroundColor: primary + "22",
        fill: true,
        tension: 0.3,
      }],
    };

    const tailorPerDay = {
      labels: data.charts.tailorPerDay.map((d) => d._id),
      datasets: [{
        label: "Tailor sessions",
        data: data.charts.tailorPerDay.map((d) => d.count),
        borderColor: palette[1],
        backgroundColor: palette[1] + "22",
        fill: true,
        tension: 0.3,
      }],
    };

    const appsPerDay = {
      labels: data.charts.appsPerDay.map((d) => d._id),
      datasets: [{
        label: "Applications added",
        data: data.charts.appsPerDay.map((d) => d.count),
        backgroundColor: palette[2] + "AA",
        borderColor: palette[2],
        borderWidth: 1,
      }],
    };

    const stageBreakdown = {
      labels: STAGE_ORDER.filter((s) => data.breakdowns.applicationsByStage[s]),
      datasets: [{
        data: STAGE_ORDER.filter((s) => data.breakdowns.applicationsByStage[s]).map((s) => data.breakdowns.applicationsByStage[s] || 0),
        backgroundColor: palette.slice(0, STAGE_ORDER.length).map((c) => c + "AA"),
        borderColor: border,
        borderWidth: 1,
      }],
    };

    const barOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: fg, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: fg, font: { size: 10 } }, grid: { color: border } },
      },
    } as const;

    const doughnutOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" as const, labels: { color: fg, font: { size: 11 } } },
      },
    } as const;

    return { userGrowth, tailorPerDay, appsPerDay, stageBreakdown, lineOpts, barOpts, doughnutOpts };
  }, [data]);

  if (loading) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Loading platform snapshot…</p>
      </div>
    );
  }

  if (!data || !charts) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">No data available.</p>
      </div>
    );
  }

  const s = data.stats;
  const avgFit = s.avgFitScore != null ? s.avgFitScore.toFixed(2) : "—";

  // Compute health pings from already-loaded data so we don't need an extra API hit.
  const health = [
    { label: "API", ok: true },
    { label: "Database", ok: data.recentActivity != null },
    { label: "AI provider", ok: Object.keys(data.breakdowns.aiKeysByProvider).length > 0 || data.stats.tailorSessionsTotal > 0 },
    { label: "Email scan", ok: data.stats.gmailConnectedUsers + data.stats.outlookConnectedUsers > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Snapshot of users, application activity, integrations, AI usage, and feedback.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {health.map((h) => (
            <span key={h.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${h.ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              {h.label}
              <span className="text-muted-foreground">{h.ok ? "online" : "idle"}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ===== KPI strip ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total users" value={s.totalUsers} subValue={`${s.adminUsers} admin · ${s.regularUsers} user`} />
        <Kpi label="Active (7d)" value={s.activeUsers7d} subValue={`+${s.signupsThisWeek} signups this week`} />
        <Kpi label="Applications" value={s.totalApplications} subValue={`${s.totalResumes} resumes`} />
        <Kpi label="Mailbox-connected" value={s.anyMailboxConnected} subValue={`Gmail ${s.gmailConnectedUsers} · Outlook ${s.outlookConnectedUsers}`} />
        <Kpi label="BYOK keys" value={s.aiByokUserCount} subValue="Users with own AI keys" />
        <Kpi label="Open feedback" value={s.feedbackOpen} subValue="In the admin inbox" highlight={s.feedbackOpen > 0} link="/admin/feedback" />
      </div>

      {/* ===== Growth charts ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="User signups (30d)" subtitle={`+${s.signupsThisMonth} this month`}>
          <Line ref={userGrowthRef} data={charts.userGrowth} options={charts.lineOpts} />
        </ChartCard>
        <ChartCard title="Applications tracked (30d)">
          <Bar ref={appsPerDayRef} data={charts.appsPerDay} options={charts.barOpts} />
        </ChartCard>
        <ChartCard title="Tailor sessions (30d)" subtitle={`${s.tailorSessionsTotal} total · avg fit ${avgFit}/5`}>
          <Line ref={tailorPerDayRef} data={charts.tailorPerDay} options={charts.lineOpts} />
        </ChartCard>
      </div>

      {/* ===== Breakdowns row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Application pipeline" subtitle="Current stage distribution">
          {Object.values(data.breakdowns.applicationsByStage).reduce((a, b) => a + b, 0) === 0 ? (
            <EmptyChart label="No applications tracked yet" />
          ) : (
            <Doughnut ref={stageRef} data={charts.stageBreakdown} options={charts.doughnutOpts} />
          )}
        </ChartCard>

        <Card title="Email signals (30d)" subtitle="Auto-detections from connected inboxes">
          <SignalList signals={data.breakdowns.signalsThisMonth} />
        </Card>

        <Card title="AI providers in use" subtitle="Active BYOK keys per provider">
          <ProviderBars providers={data.breakdowns.aiKeysByProvider} />
        </Card>
      </div>

      {/* ===== Secondary metrics row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Tailor fit grades" subtitle="Distribution across last 30 days">
          <FitGradeBars dist={data.breakdowns.tailorFitDistribution} />
        </Card>

        <Card title="Profile coverage" subtitle="Users with structured master profiles">
          <ProfileCoverage masterProfileUsers={s.masterProfileUsers} totalUsers={s.totalUsers} />
        </Card>

        <Card title="Feedback by type" subtitle="All-time inbox breakdown">
          <FeedbackBars byType={data.breakdowns.feedbackByType} />
        </Card>
      </div>

      {/* ===== Recent audit activity ===== */}
      <div className="bg-card border border-border rounded-xl">
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
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${actionColors[a.action] ?? "bg-muted text-muted-foreground"}`}>
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

function Kpi({ label, value, subValue, highlight, link }: { label: string; value: number | string; subValue?: string; highlight?: boolean; link?: string }) {
  const inner = (
    <div className={`border rounded-xl p-4 transition-colors h-full ${
      highlight
        ? "border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20"
        : "border-border bg-card hover:border-foreground/20"
    }`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
      {subValue && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{subValue}</p>}
    </div>
  );
  if (link) return <Link to={link}>{inner}</Link>;
  return inner;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
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

function SignalList({ signals }: { signals: Record<string, number> }) {
  const total = Object.values(signals).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground py-6 text-center">No signals detected this month.</p>;
  return (
    <ul className="space-y-2.5">
      {["interview_detected", "offer_detected", "rejection_detected", "follow_up_detected"].map((k) => {
        const v = signals[k] || 0;
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        const tone =
          k === "interview_detected" ? "bg-purple-500" :
          k === "offer_detected" ? "bg-emerald-500" :
          k === "rejection_detected" ? "bg-red-500" :
          "bg-amber-500";
        return (
          <li key={k}>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-foreground">{SIGNAL_LABELS[k]}</span>
              <span className="text-muted-foreground tabular-nums">{v} · {pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ProviderBars({ providers }: { providers: Record<string, number> }) {
  const entries = Object.entries(providers);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground py-6 text-center">No BYOK keys configured yet.</p>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <ul className="space-y-2.5">
      {entries.sort((a, b) => b[1] - a[1]).map(([p, v]) => (
        <li key={p}>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-foreground capitalize">{p}</span>
            <span className="text-muted-foreground tabular-nums">{v} {v === 1 ? "user" : "users"}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FitGradeBars({ dist }: { dist: Record<string, number> }) {
  const grades = ["A", "B", "C", "D", "F"];
  const total = grades.reduce((s, g) => s + (dist[g] || 0), 0);
  if (total === 0) return <p className="text-xs text-muted-foreground py-6 text-center">No tailor sessions yet.</p>;
  const tones: Record<string, string> = { A: "bg-emerald-500", B: "bg-blue-500", C: "bg-amber-500", D: "bg-orange-500", F: "bg-red-500" };
  return (
    <ul className="space-y-2.5">
      {grades.map((g) => {
        const v = dist[g] || 0;
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        return (
          <li key={g}>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-foreground font-semibold">Grade {g}</span>
              <span className="text-muted-foreground tabular-nums">{v} · {pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${tones[g]} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
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
      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        return (
          <li key={t.key}>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-foreground">{t.label}</span>
              <span className="text-muted-foreground tabular-nums">{v} · {pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${t.tone} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
