import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  analyticsAPI,
  applicationsAPI,
  deadlinesAPI,
  resumesAPI,
} from "../../utils/api.js";
import DashboardGrid from "../../components/DashboardGrid/DashboardGrid.jsx";
import "./Dashboard.css";

const FUNNEL_STAGES = ["Applied", "OA", "Interview", "Offer"];
const STAGE_COLORS = {
  Applied: "#1a6cc9",
  OA: "#9a5a0d",
  Interview: "#3d3aa0",
  Offer: "#157a58",
  Rejected: "#b92827",
};

const DEFAULT_LAYOUTS = {
  lg: [
    { i: "recent", x: 0, y: 0, w: 7, h: 5, minW: 4, minH: 4 },
    { i: "deadlines", x: 7, y: 0, w: 5, h: 5, minW: 3, minH: 4 },
    { i: "funnel", x: 0, y: 5, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "conversion", x: 6, y: 5, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "trend", x: 0, y: 10, w: 6, h: 5, minW: 4, minH: 4 },
    { i: "resume", x: 6, y: 10, w: 6, h: 5, minW: 4, minH: 4 },
  ],
  md: [
    { i: "recent", x: 0, y: 0, w: 6, h: 5 },
    { i: "deadlines", x: 6, y: 0, w: 4, h: 5 },
    { i: "funnel", x: 0, y: 5, w: 5, h: 5 },
    { i: "conversion", x: 5, y: 5, w: 5, h: 5 },
    { i: "trend", x: 0, y: 10, w: 5, h: 5 },
    { i: "resume", x: 5, y: 10, w: 5, h: 5 },
  ],
  sm: [
    { i: "recent", x: 0, y: 0, w: 6, h: 5 },
    { i: "deadlines", x: 0, y: 5, w: 6, h: 5 },
    { i: "funnel", x: 0, y: 10, w: 6, h: 5 },
    { i: "conversion", x: 0, y: 15, w: 6, h: 5 },
    { i: "trend", x: 0, y: 20, w: 6, h: 5 },
    { i: "resume", x: 0, y: 25, w: 6, h: 5 },
  ],
  xs: [
    { i: "recent", x: 0, y: 0, w: 4, h: 5 },
    { i: "deadlines", x: 0, y: 5, w: 4, h: 5 },
    { i: "funnel", x: 0, y: 10, w: 4, h: 5 },
    { i: "conversion", x: 0, y: 15, w: 4, h: 5 },
    { i: "trend", x: 0, y: 20, w: 4, h: 5 },
    { i: "resume", x: 0, y: 25, w: 4, h: 5 },
  ],
  xxs: [
    { i: "recent", x: 0, y: 0, w: 2, h: 5 },
    { i: "deadlines", x: 0, y: 5, w: 2, h: 5 },
    { i: "funnel", x: 0, y: 10, w: 2, h: 5 },
    { i: "conversion", x: 0, y: 15, w: 2, h: 5 },
    { i: "trend", x: 0, y: 20, w: 2, h: 5 },
    { i: "resume", x: 0, y: 25, w: 2, h: 5 },
  ],
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsData, appsData, deadlinesData, resumesData] =
          await Promise.all([
            analyticsAPI.get(),
            applicationsAPI.getAll(),
            deadlinesAPI.getAll(),
            resumesAPI.getAll(),
          ]);

        setStats(analyticsData);
        setRecentApps(appsData.slice(0, 5));
        setResumes(resumesData);

        const now = new Date();
        const upcoming = deadlinesData
          .filter((d) => !d.completed && new Date(d.dueDate) >= now)
          .slice(0, 5);
        setUpcomingDeadlines(upcoming);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getBadgeClass = (stage) => {
    const map = {
      Applied: "badge-applied",
      OA: "badge-oa",
      Interview: "badge-interview",
      Offer: "badge-offer",
      Rejected: "badge-rejected",
    };
    return map[stage] || "badge-applied";
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const daysUntil = (dateStr) => {
    const diff = Math.ceil(
      (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `${diff} days`;
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  const funnel = stats?.funnel || {};
  const total = stats?.total || 0;
  const resumePerformance = stats?.resumePerformance || [];
  const weeklyTrend = stats?.weeklyTrend || [];

  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: s,
    count: funnel[s] || 0,
  }));

  const conversionData = [];
  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const prev = funnel[FUNNEL_STAGES[i - 1]] || 0;
    const curr = funnel[FUNNEL_STAGES[i]] || 0;
    const rate = prev > 0 ? Math.round((curr / prev) * 100) : 0;
    conversionData.push({
      from: FUNNEL_STAGES[i - 1],
      to: FUNNEL_STAGES[i],
      rate,
      count: curr,
      prevCount: prev,
    });
  }

  const resumeData = resumePerformance.map((rp) => {
    const resume = resumes.find((r) => r._id === rp._id);
    const rate =
      rp.total > 0 ? Math.round((rp.responses / rp.total) * 100) : 0;
    return {
      name: resume ? resume.name : "Unknown",
      total: rp.total,
      responses: rp.responses,
      rate,
    };
  });

  const trendData = weeklyTrend.map((w) => ({
    week: new Date(w.firstDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: w.count,
  }));

  const activeTotal = total - (funnel.Rejected || 0);

  const recentCard = (
    <section className="card" aria-label="Recent applications">
      <div className="card-section-header">
        <h2>Recent applications</h2>
        <Link to="/applications" className="card-section-link">
          View all
        </Link>
      </div>
      {recentApps.length === 0 ? (
        <div className="empty-state">
          <h3>No applications yet</h3>
          <p>Start tracking your job search</p>
          <Link to="/applications" className="btn btn-primary btn-sm">
            Add your first application
          </Link>
        </div>
      ) : (
        <div className="table-wrapper" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Role</th>
                <th scope="col">Stage</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app) => (
                <tr key={app._id}>
                  <td style={{ fontWeight: 500 }}>{app.company}</td>
                  <td>{app.role}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(app.stage)}`}>
                      {app.stage}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {formatDate(app.applicationDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const deadlinesCard = (
    <section className="card" aria-label="Upcoming deadlines">
      <div className="card-section-header">
        <h2>Upcoming deadlines</h2>
        <Link to="/deadlines" className="card-section-link">
          View all
        </Link>
      </div>
      {upcomingDeadlines.length === 0 ? (
        <div className="empty-state">
          <h3>No upcoming deadlines</h3>
          <p>You&apos;re all caught up</p>
        </div>
      ) : (
        <div className="deadline-list">
          {upcomingDeadlines.map((d) => (
            <div key={d._id} className="deadline-item">
              <div className="deadline-info">
                <span className="deadline-type">{d.type}</span>
                {d.notes && <span className="deadline-notes">{d.notes}</span>}
              </div>
              <span className="deadline-due">{daysUntil(d.dueDate)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const funnelCard = (
    <section className="card" aria-label="Application funnel">
      <h2 className="analytics-section-title">Application funnel</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={funnelData} barSize={40}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e5ea"
              vertical={false}
            />
            <XAxis
              dataKey="stage"
              tick={{ fontSize: 13, fill: "#5a6170" }}
              axisLine={{ stroke: "#e2e5ea" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#8c919e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e2e5ea",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {funnelData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={STAGE_COLORS[entry.stage] || "#378ADD"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const conversionCard = (
    <section className="card" aria-label="Stage conversion rates">
      <h2 className="analytics-section-title">Stage conversion rates</h2>
      <div className="conversion-list">
        {conversionData.map((c) => (
          <div key={c.to} className="conversion-item">
            <div className="conversion-label">
              {c.from} → {c.to}
            </div>
            <div className="conversion-bar-track">
              <div
                className="conversion-bar-fill"
                style={{ width: `${Math.min(c.rate, 100)}%` }}
              ></div>
            </div>
            <div className="conversion-stats">
              <span className="conversion-rate">{c.rate}%</span>
              <span className="conversion-counts">
                {c.count}/{c.prevCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const trendCard = (
    <section className="card" aria-label="Applications over time">
      <h2 className="analytics-section-title">Applications over time</h2>
      <div className="chart-container">
        {trendData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e5ea"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "#8c919e" }}
                axisLine={{ stroke: "#e2e5ea" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#8c919e" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e2e5ea",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#378ADD"
                strokeWidth={2}
                dot={{ fill: "#378ADD", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <p>Not enough data yet</p>
          </div>
        )}
      </div>
    </section>
  );

  const resumeCard = (
    <section className="card" aria-label="Resume performance">
      <h2 className="analytics-section-title">Resume performance</h2>
      {resumeData.length === 0 ? (
        <div className="empty-state">
          <p>Link applications to resumes to see performance.</p>
        </div>
      ) : (
        <div className="table-wrapper" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Resume version</th>
                <th scope="col">Apps</th>
                <th scope="col">Responses</th>
                <th scope="col">Rate</th>
              </tr>
            </thead>
            <tbody>
              {resumeData.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>{r.total}</td>
                  <td>{r.responses}</td>
                  <td>
                    <div className="resume-rate">
                      <div className="resume-rate-bar-track">
                        <div
                          className="resume-rate-bar-fill"
                          style={{ width: `${Math.min(r.rate, 100)}%` }}
                        ></div>
                      </div>
                      <span className="resume-rate-value">{r.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const gridItems = [
    { key: "recent", node: recentCard },
    { key: "deadlines", node: deadlinesCard },
    { key: "funnel", node: funnelCard },
    { key: "conversion", node: conversionCard },
    { key: "trend", node: trendCard },
    { key: "resume", node: resumeCard },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/applications" className="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          New application
        </Link>
      </div>

      {/* Primary stats */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">Total applications</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In progress</div>
          <div className="stat-value">
            {(funnel.OA || 0) + (funnel.Interview || 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offers</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {funnel.Offer || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>
            {funnel.Rejected || 0}
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      {total > 0 && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">Response rate</div>
            <div className="stat-value">
              {activeTotal > 0
                ? Math.round(
                    (((funnel.OA || 0) +
                      (funnel.Interview || 0) +
                      (funnel.Offer || 0)) /
                      activeTotal) *
                      100
                  )
                : 0}
              %
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Offer rate</div>
            <div className="stat-value" style={{ color: "var(--success)" }}>
              {total > 0 ? Math.round(((funnel.Offer || 0) / total) * 100) : 0}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejection rate</div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>
              {total > 0
                ? Math.round(((funnel.Rejected || 0) / total) * 100)
                : 0}
              %
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resume versions</div>
            <div className="stat-value">{resumes.length}</div>
          </div>
        </div>
      )}

      <DashboardGrid items={gridItems} defaultLayouts={DEFAULT_LAYOUTS} />
    </div>
  );
}

export default Dashboard;
