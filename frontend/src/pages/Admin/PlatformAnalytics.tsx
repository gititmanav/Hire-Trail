import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Bar } from "react-chartjs-2";
import "../../utils/chartSetup";
import { adminAPI } from "../../utils/api";
import type { PlatformAnalyticsData } from "../../types";

const rateColors: Record<string, { bg: string; text: string; bar: string }> = {
  oaRate: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  interviewRate: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", bar: "bg-purple-500" },
  offerRate: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", bar: "bg-green-500" },
  rejectionRate: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", bar: "bg-red-500" },
};

const rateLabels: Record<string, string> = {
  oaRate: "OA Rate",
  interviewRate: "Interview Rate",
  offerRate: "Offer Rate",
  rejectionRate: "Rejection Rate",
};

const stageColors: Record<string, string> = {
  Applied: "rgba(59,130,246,0.7)",
  OA: "rgba(139,92,246,0.7)",
  Interview: "rgba(245,158,11,0.7)",
  Offer: "rgba(16,185,129,0.7)",
  Rejected: "rgba(239,68,68,0.7)",
};

export default function PlatformAnalytics() {
  const [data, setData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getPlatformAnalytics()
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

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

  const funnelData = {
    labels: funnel.map((f) => f._id),
    datasets: [
      {
        label: "Count",
        data: funnel.map((f) => f.count),
        backgroundColor: funnel.map((f) => stageColors[f._id] || "rgba(156,163,175,0.7)"),
        borderWidth: 0,
      },
    ],
  };

  const companiesData = {
    labels: topCompanies.map((c) => c._id),
    datasets: [
      {
        label: "Applications",
        data: topCompanies.map((c) => c.count),
        backgroundColor: "rgba(99,102,241,0.7)",
        borderWidth: 0,
      },
    ],
  };

  const rolesData = {
    labels: topRoles.map((r) => r._id),
    datasets: [
      {
        label: "Applications",
        data: topRoles.map((r) => r.count),
        backgroundColor: "rgba(16,185,129,0.7)",
        borderWidth: 0,
      },
    ],
  };

  const horizontalOpts = {
    indexAxis: "y" as const,
    scales: {
      x: { beginAtZero: true, ticks: { color: "#9ca3af" }, grid: { color: "rgba(156,163,175,0.15)" } },
      y: { ticks: { color: "#9ca3af" }, grid: { display: false } },
    },
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>

      {/* Conversion Rate Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(rateLabels) as (keyof typeof rateLabels)[]).map((key) => {
          const val = conversionRates[key as keyof typeof conversionRates];
          const color = rateColors[key];
          return (
            <div key={key} className={`card-premium p-4 ${color.bg}`}>
              <p className="text-sm text-muted-foreground">{rateLabels[key]}</p>
              <p className={`text-3xl font-bold ${color.text}`}>{val.toFixed(1)}%</p>
              <div className="mt-2 w-full h-2 bg-border rounded-full overflow-hidden">
                <div className={`h-full ${color.bar} rounded-full`} style={{ width: `${Math.min(val, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel */}
      <div className="card-premium p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform Funnel</h2>
        <div className="h-64">
          <Bar data={funnelData} options={horizontalOpts} />
        </div>
      </div>

      {/* Top Companies and Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-premium p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top 10 Companies</h2>
          <div className="h-72">
            <Bar data={companiesData} options={horizontalOpts} />
          </div>
        </div>
        <div className="card-premium p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top 10 Roles</h2>
          <div className="h-72">
            <Bar data={rolesData} options={horizontalOpts} />
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
