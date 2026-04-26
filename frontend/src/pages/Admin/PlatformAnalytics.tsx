import { useState, useEffect, useRef, useContext } from "react";
import toast from "react-hot-toast";
import { Bar } from "react-chartjs-2";
import "../../utils/chartSetup";
import { chartColors, mutedFgColor, borderColor, stageColor } from "../../utils/chartSetup";
import { ThemeContext } from "../../App.tsx";
import { adminAPI } from "../../utils/api";
import type { PlatformAnalyticsData } from "../../types";
import type { Chart as ChartJS } from "chart.js";

const rateLabels: Record<string, string> = {
  oaRate: "OA Rate",
  interviewRate: "Interview Rate",
  offerRate: "Offer Rate",
  rejectionRate: "Rejection Rate",
};

const RATE_COLOR_STAGE: Record<string, string> = {
  oaRate: "OA",
  interviewRate: "Interview",
  offerRate: "Offer",
  rejectionRate: "Rejected",
};

export default function PlatformAnalytics() {
  const { themeId } = useContext(ThemeContext);
  const [data, setData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const funnelRef = useRef<ChartJS<"bar">>(null);
  const companiesRef = useRef<ChartJS<"bar">>(null);
  const rolesRef = useRef<ChartJS<"bar">>(null);

  useEffect(() => {
    adminAPI
      .getPlatformAnalytics()
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  // Update chart colors on theme change
  useEffect(() => {
    const colors = chartColors();
    const m = mutedFgColor();
    const g = borderColor();

    function updateHorizontal(chart: ChartJS | null) {
      if (!chart) return;
      if (chart.options.scales?.x?.ticks) (chart.options.scales.x.ticks as any).color = m;
      if (chart.options.scales?.y?.ticks) (chart.options.scales.y.ticks as any).color = m;
      if (chart.options.scales?.x?.grid) (chart.options.scales.x.grid as any).color = g;
      chart.update("none");
    }

    if (funnelRef.current) {
      const stageNames = ["Applied", "OA", "Interview", "Offer", "Rejected"];
      funnelRef.current.data.datasets[0].backgroundColor = stageNames.map((s) => stageColor(s));
      updateHorizontal(funnelRef.current);
    }

    if (companiesRef.current) {
      companiesRef.current.data.datasets[0].backgroundColor = colors[0] || "rgba(59,130,246,0.7)";
      updateHorizontal(companiesRef.current);
    }

    if (rolesRef.current) {
      rolesRef.current.data.datasets[0].backgroundColor = colors[1] || "rgba(245,158,11,0.7)";
      updateHorizontal(rolesRef.current);
    }
  }, [themeId]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-premium animate-pulse h-28 rounded-lg" />
          ))}
        </div>
        <div className="card-premium animate-pulse h-72 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-premium animate-pulse h-72 rounded-lg" />
          <div className="card-premium animate-pulse h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { conversionRates, funnel, topCompanies, topRoles, totalApplications, totalUsers, avgAppsPerUser } = data;

  const colors = chartColors();
  const muted = mutedFgColor();
  const grid = borderColor();

  const stageNames = ["Applied", "OA", "Interview", "Offer", "Rejected"];
  const funnelData = {
    labels: funnel.map((f) => f._id),
    datasets: [{
      label: "Count",
      data: funnel.map((f) => f.count),
      backgroundColor: funnel.map((f) => {
        const idx = stageNames.indexOf(f._id);
        return idx >= 0 ? stageColor(stageNames[idx]) : "rgba(156,163,175,0.7)";
      }),
      borderWidth: 0,
    }],
  };

  const companiesData = {
    labels: topCompanies.map((c) => c._id),
    datasets: [{
      label: "Applications",
      data: topCompanies.map((c) => c.count),
      backgroundColor: colors[0] || "rgba(59,130,246,0.7)",
      borderWidth: 0,
    }],
  };

  const rolesData = {
    labels: topRoles.map((r) => r._id),
    datasets: [{
      label: "Applications",
      data: topRoles.map((r) => r.count),
      backgroundColor: colors[1] || "rgba(245,158,11,0.7)",
      borderWidth: 0,
    }],
  };

  const horizontalOpts = {
    indexAxis: "y" as const,
    scales: {
      x: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      y: { ticks: { color: muted }, grid: { display: false } },
    },
  };

  const rateColorKeys = ["oaRate", "interviewRate", "offerRate", "rejectionRate"];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>

      {/* Conversion Rate Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {rateColorKeys.map((key, i) => {
          const val = conversionRates[key as keyof typeof conversionRates];
          const stageForRate = RATE_COLOR_STAGE[key] || "Applied";
          const color = stageColor(stageForRate);
          return (
            <div key={key} className="card-premium p-4 bg-muted">
              <p className="text-sm text-muted-foreground">{rateLabels[key]}</p>
              <p className="text-3xl font-bold text-foreground">{val.toFixed(1)}%</p>
              <div className="mt-2 w-full h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel */}
      <div className="card-premium p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform Funnel</h2>
        <div className="h-64">
          <Bar ref={funnelRef} data={funnelData} options={horizontalOpts} />
        </div>
      </div>

      {/* Top Companies and Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-premium p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top 10 Companies</h2>
          <div className="h-72">
            <Bar ref={companiesRef} data={companiesData} options={horizontalOpts} />
          </div>
        </div>
        <div className="card-premium p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top 10 Roles</h2>
          <div className="h-72">
            <Bar ref={rolesRef} data={rolesData} options={horizontalOpts} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-premium p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Applications</p>
          <p className="text-2xl font-bold text-foreground">{totalApplications.toLocaleString()}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold text-foreground">{totalUsers.toLocaleString()}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-sm text-muted-foreground">Avg Apps / User</p>
          <p className="text-2xl font-bold text-foreground">{avgAppsPerUser.toFixed(1)}</p>
        </div>
      </div>
    </div>
  );
}
