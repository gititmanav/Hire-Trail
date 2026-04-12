import { useState, useEffect, useRef, useContext } from "react";
import toast from "react-hot-toast";
import { Responsive, WidthProvider } from "react-grid-layout";
import { Line, Bar } from "react-chartjs-2";
import "../../utils/chartSetup";
import { chartColors, primaryColor, mutedFgColor, borderColor } from "../../utils/chartSetup";
import { ThemeContext } from "../../App.tsx";
import { adminAPI } from "../../utils/api";
import { useAdminWidgetLayout, ADMIN_WIDGETS } from "../../hooks/useAdminWidgetLayout";
import AdminWidgetPicker from "../../components/WidgetPicker/AdminWidgetPicker";
import type { AdminDashboardData, AuditLog, PlatformAnalyticsData } from "../../types";
import type { Chart as ChartJS } from "chart.js";
import "react-grid-layout/css/styles.css";

const RGL = WidthProvider(Responsive);

/* ── colour maps (Tailwind classes — these respond to dark mode via .dark) ── */
const actionColors: Record<string, string> = {
  login: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  suspend: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  role_change: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const rateLabels: Record<string, string> = { oaRate: "OA Rate", interviewRate: "Interview Rate", offerRate: "Offer Rate", rejectionRate: "Rejection Rate" };

function getUserName(userId: AuditLog["userId"]): string {
  if (typeof userId === "object" && userId !== null) return userId.name;
  return "System";
}

export default function AdminDashboard() {
  const { themeId } = useContext(ThemeContext);
  const [dashData, setDashData] = useState<AdminDashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { layout, visible, locked, onLayoutChange, toggleWidget, toggleLock, resetLayout } = useAdminWidgetLayout();

  // Chart refs for imperative theme updates
  const userGrowthRef = useRef<ChartJS<"line">>(null);
  const appsPerDayRef = useRef<ChartJS<"bar">>(null);
  const funnelRef = useRef<ChartJS<"bar">>(null);
  const topCompaniesRef = useRef<ChartJS<"bar">>(null);
  const topRolesRef = useRef<ChartJS<"bar">>(null);
  const rejectionsRef = useRef<ChartJS<"bar">>(null);

  useEffect(() => {
    Promise.all([
      adminAPI.getDashboard(),
      adminAPI.getPlatformAnalytics(),
    ])
      .then(([dash, analytics]) => { setDashData(dash); setAnalyticsData(analytics); })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  // Update all chart colors when theme changes
  useEffect(() => {
    const colors = chartColors();
    const m = mutedFgColor();
    const g = borderColor();
    const p = primaryColor();
    const pFill = p.replace("hsl(", "hsla(").replace(")", " / 0.15)");

    function updateScales(chart: ChartJS | null, horizontal = false) {
      if (!chart) return;
      const xAxis = horizontal ? "x" : "x";
      const yAxis = horizontal ? "y" : "y";
      if (chart.options.scales?.[xAxis]?.ticks) (chart.options.scales[xAxis]!.ticks as any).color = m;
      if (chart.options.scales?.[yAxis]?.ticks) (chart.options.scales[yAxis]!.ticks as any).color = m;
      if (chart.options.scales?.x?.grid) (chart.options.scales.x.grid as any).color = horizontal ? g : undefined;
      if (chart.options.scales?.y?.grid) (chart.options.scales.y.grid as any).color = horizontal ? undefined : g;
      chart.update("none");
    }

    // User growth
    if (userGrowthRef.current) {
      const chart = userGrowthRef.current;
      const ds = chart.data.datasets[0];
      ds.borderColor = p;
      ds.backgroundColor = pFill;
      updateScales(chart);
    }

    // Apps per day
    if (appsPerDayRef.current) {
      const chart = appsPerDayRef.current;
      chart.data.datasets[0].backgroundColor = colors[3] || "rgba(16,185,129,0.7)";
      chart.data.datasets[0].borderColor = colors[3] || "#10b981";
      updateScales(chart);
    }

    // Funnel
    if (funnelRef.current) {
      const chart = funnelRef.current;
      // Keep stage colors for semantic meaning, but update scales
      if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
      if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
      if (chart.options.scales?.x?.grid) (chart.options.scales.x.grid as any).color = g;
      chart.update("none");
    }

    // Top companies
    if (topCompaniesRef.current) {
      const chart = topCompaniesRef.current;
      chart.data.datasets[0].backgroundColor = colors[2] || "rgba(99,102,241,0.7)";
      if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
      if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
      if (chart.options.scales?.x?.grid) (chart.options.scales.x.grid as any).color = g;
      chart.update("none");
    }

    // Top roles
    if (topRolesRef.current) {
      const chart = topRolesRef.current;
      chart.data.datasets[0].backgroundColor = colors[3] || "rgba(16,185,129,0.7)";
      if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
      if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
      if (chart.options.scales?.x?.grid) (chart.options.scales.x.grid as any).color = g;
      chart.update("none");
    }

    // Rejections per day
    if (rejectionsRef.current) {
      const chart = rejectionsRef.current;
      chart.data.datasets[0].backgroundColor = colors[4] || "rgba(239,68,68,0.7)";
      chart.data.datasets[0].borderColor = colors[4] || "#ef4444";
      updateScales(chart);
    }
  }, [themeId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-premium animate-pulse h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-premium animate-pulse h-72 rounded-lg" />
          <div className="card-premium animate-pulse h-72 rounded-lg" />
        </div>
        <div className="card-premium animate-pulse h-64 rounded-lg" />
      </div>
    );
  }

  if (!dashData) return null;

  const { stats, charts, recentActivity } = dashData;

  // Read theme-aware colors for initial chart render
  const colors = chartColors();
  const muted = mutedFgColor();
  const grid = borderColor();
  const primary = primaryColor();
  const primaryFill = primary.replace("hsl(", "hsla(").replace(")", " / 0.15)");

  /* ── chart options (theme-aware) ── */
  const chartOpts = {
    scales: {
      y: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      x: { ticks: { color: muted, maxRotation: 45 }, grid: { display: false } },
    },
    maintainAspectRatio: false,
  };

  const horizontalOpts = {
    indexAxis: "y" as const,
    scales: {
      x: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      y: { ticks: { color: muted }, grid: { display: false } },
    },
    maintainAspectRatio: false,
  };

  const title = (id: string) => ADMIN_WIDGETS.find((w) => w.id === id)?.title || id;

  const renderWidget = (id: string) => {
    switch (id) {
      case "stats": {
        const statCards = [
          { label: "Total Users", value: stats.totalUsers },
          { label: "Total Apps", value: stats.totalApplications },
          { label: "Signups This Week", value: stats.signupsThisWeek },
          { label: "Active Users (7d)", value: stats.activeUsers7d },
          { label: "Gmail Connected", value: stats.gmailConnectedUsers },
          { label: "Rejections (30d)", value: stats.rejectionsDetected30d },
          { label: "Total Resumes", value: stats.totalResumes },
          { label: "Total Contacts", value: stats.totalContacts },
        ];
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 h-full items-center">
            {statCards.map((s) => (
              <div key={s.label} className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        );
      }
      case "user-growth": {
        const data = {
          labels: charts.userGrowth.map((d) => new Date(d._id).toLocaleDateString()),
          datasets: [{
            label: "Users", data: charts.userGrowth.map((d) => d.count),
            borderColor: primary, backgroundColor: primaryFill, fill: true, tension: 0.3,
          }],
        };
        return <div className="h-full"><Line ref={userGrowthRef} data={data} options={chartOpts} /></div>;
      }
      case "apps-per-day": {
        const data = {
          labels: charts.appsPerDay.map((d) => new Date(d._id).toLocaleDateString()),
          datasets: [{
            label: "Applications", data: charts.appsPerDay.map((d) => d.count),
            backgroundColor: colors[3] || "rgba(16,185,129,0.7)", borderColor: colors[3] || "#10b981", borderWidth: 1,
          }],
        };
        return <div className="h-full"><Bar ref={appsPerDayRef} data={data} options={chartOpts} /></div>;
      }
      case "activity":
        return (
          <div className="h-full overflow-y-auto space-y-2">
            {recentActivity.length === 0 && (
              <p className="text-muted-foreground text-sm">No recent activity.</p>
            )}
            {recentActivity.map((log) => (
              <div key={log._id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {getUserName(log.userId)}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || "bg-muted text-foreground"}`}>
                  {log.action}
                </span>
                <span className="text-xs text-muted-foreground">{log.resourceType}</span>
              </div>
            ))}
          </div>
        );
      case "conversion-rates": {
        if (!analyticsData) return <p className="text-muted-foreground text-sm">Loading analytics...</p>;
        const { conversionRates } = analyticsData;
        const rateColorKeys = ["oaRate", "interviewRate", "offerRate", "rejectionRate"];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full items-center">
            {rateColorKeys.map((key, i) => {
              const val = conversionRates[key as keyof typeof conversionRates];
              const color = colors[i] || muted;
              return (
                <div key={key} className="rounded-lg p-3 bg-muted">
                  <p className="text-xs text-muted-foreground">{rateLabels[key]}</p>
                  <p className="text-2xl font-bold text-foreground">{val.toFixed(1)}%</p>
                  <div className="mt-1.5 w-full h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case "funnel": {
        if (!analyticsData) return null;
        const stageColors: Record<string, string> = {};
        const stageNames = ["Applied", "OA", "Interview", "Offer", "Rejected"];
        stageNames.forEach((s, i) => { stageColors[s] = colors[i] || `rgba(156,163,175,0.7)`; });
        const data = {
          labels: analyticsData.funnel.map((f) => f._id),
          datasets: [{
            label: "Count", data: analyticsData.funnel.map((f) => f.count),
            backgroundColor: analyticsData.funnel.map((f) => stageColors[f._id] || "rgba(156,163,175,0.7)"),
            borderWidth: 0,
          }],
        };
        return <div className="h-full"><Bar ref={funnelRef} data={data} options={horizontalOpts} /></div>;
      }
      case "top-companies": {
        if (!analyticsData) return null;
        const data = {
          labels: analyticsData.topCompanies.map((c) => c._id),
          datasets: [{
            label: "Applications", data: analyticsData.topCompanies.map((c) => c.count),
            backgroundColor: colors[2] || "rgba(99,102,241,0.7)", borderWidth: 0,
          }],
        };
        return <div className="h-full"><Bar ref={topCompaniesRef} data={data} options={horizontalOpts} /></div>;
      }
      case "top-roles": {
        if (!analyticsData) return null;
        const data = {
          labels: analyticsData.topRoles.map((r) => r._id),
          datasets: [{
            label: "Applications", data: analyticsData.topRoles.map((r) => r.count),
            backgroundColor: colors[3] || "rgba(16,185,129,0.7)", borderWidth: 0,
          }],
        };
        return <div className="h-full"><Bar ref={topRolesRef} data={data} options={horizontalOpts} /></div>;
      }
      case "rejections-per-day": {
        const rpd = charts.rejectionsPerDay || [];
        if (rpd.length === 0) return <p className="text-muted-foreground text-sm">No rejection data yet.</p>;
        const data = {
          labels: rpd.map((d) => new Date(d._id).toLocaleDateString()),
          datasets: [{
            label: "Rejections", data: rpd.map((d) => d.count),
            backgroundColor: colors[4] || "rgba(239,68,68,0.7)", borderColor: colors[4] || "#ef4444", borderWidth: 1,
          }],
        };
        return <div className="h-full"><Bar ref={rejectionsRef} data={data} options={chartOpts} /></div>;
      }
      case "summary": {
        if (!analyticsData) return null;
        const items = [
          { label: "Total Applications", value: analyticsData.totalApplications.toLocaleString() },
          { label: "Total Users", value: analyticsData.totalUsers.toLocaleString() },
          { label: "Avg Apps / User", value: analyticsData.avgAppsPerUser.toFixed(1) },
        ];
        return (
          <div className="grid grid-cols-3 gap-3 h-full items-center">
            {items.map((s) => (
              <div key={s.label} className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggleLock} className={`btn-secondary !px-2.5 ${locked ? "!border-primary !text-primary dark:!text-primary" : ""}`} title={locked ? "Unlock dashboard" : "Lock dashboard"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300">
              {locked ? (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>) : (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></>)}
            </svg>
          </button>
          <button onClick={() => setPickerOpen(true)} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Widgets
          </button>
        </div>
      </div>

      <div className={locked ? "dashboard-locked" : "dashboard-unlocked"}>
        <RGL
          className="dashboard-grid"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1024, md: 768, sm: 480 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={50}
          onLayoutChange={(nl) => onLayoutChange(nl)}
          isDraggable={!locked}
          isResizable={!locked}
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {layout.filter((l) => visible[l.i]).map((l) => (
            <div key={l.i}>
              <div className="card-premium h-full flex flex-col">
                {l.i !== "stats" && l.i !== "conversion-rates" && l.i !== "summary" && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                    <h3 className="text-[13px] font-semibold text-foreground">{title(l.i)}</h3>
                  </div>
                )}
                <div className={`flex-1 ${l.i === "stats" || l.i === "conversion-rates" || l.i === "summary" ? "p-3" : "p-4"} overflow-hidden`}>
                  {renderWidget(l.i)}
                </div>
              </div>
            </div>
          ))}
        </RGL>
      </div>

      {pickerOpen && <AdminWidgetPicker visible={visible} onToggle={toggleWidget} onReset={resetLayout} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
