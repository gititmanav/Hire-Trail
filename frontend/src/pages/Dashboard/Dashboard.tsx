import { useState, useEffect } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { Link } from "react-router-dom";
import { analyticsAPI, applicationsAPI, deadlinesAPI, resumesAPI } from "../../utils/api.ts";
import { useWidgetLayout, ALL_WIDGETS } from "../../hooks/useWidgetLayout.ts";
import WidgetPicker from "../../components/WidgetPicker/WidgetPicker.tsx";
import StatsWidget from "../../components/widgets/StatsWidget.tsx";
import FunnelWidget from "../../components/widgets/FunnelWidget.tsx";
import ConversionWidget from "../../components/widgets/ConversionWidget.tsx";
import TrendWidget from "../../components/widgets/TrendWidget.tsx";
import PieWidget from "../../components/widgets/PieWidget.tsx";
import ResumePerformanceWidget from "../../components/widgets/ResumePerformanceWidget.tsx";
import RecentAppsWidget from "../../components/widgets/RecentAppsWidget.tsx";
import DeadlinesWidget from "../../components/widgets/DeadlinesWidget.tsx";
import { SkeletonStats, SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import type { Application, Deadline, Resume, AnalyticsData } from "../../types";
import "react-grid-layout/css/styles.css";

const RGL = WidthProvider(Responsive);

export default function Dashboard() {
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { layout, visible, locked, onLayoutChange, toggleWidget, toggleLock, resetLayout } = useWidgetLayout();

  useEffect(() => {
    (async () => {
      try {
        const [a, ap, dl, r] = await Promise.all([
          analyticsAPI.get(),
          applicationsAPI.getAll({ limit: 8, sort: "createdAt", order: "desc" }),
          deadlinesAPI.getAll({ limit: 100 }),
          resumesAPI.getAll(),
        ]);
        setStats(a);
        setApps(ap.data);
        setResumes(r);

        // Upcoming deadlines: NOT completed AND dueDate is today or later
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = dl.data
          .filter((d) => {
            if (d.completed) return false;
            const due = new Date(d.dueDate);
            due.setHours(0, 0, 0, 0);
            return due.getTime() >= today.getTime();
          })
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, 8);
        setDeadlines(upcoming);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="fade-up"><SkeletonStats /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4"><SkeletonTable /><SkeletonTable rows={4} /></div></div>;

  const render = (id: string) => {
    if (!stats) return null;
    switch (id) {
      case "stats": return <StatsWidget data={stats} />;
      case "funnel": return <FunnelWidget data={stats} />;
      case "conversion": return <ConversionWidget data={stats} />;
      case "trend": return <TrendWidget data={stats} />;
      case "pie": return <PieWidget data={stats} />;
      case "resume-perf": return <ResumePerformanceWidget data={stats} resumes={resumes} />;
      case "recent-apps": return <RecentAppsWidget apps={apps} />;
      case "deadlines": return <DeadlinesWidget deadlines={deadlines} />;
      default: return null;
    }
  };

  const title = (id: string) => ALL_WIDGETS.find((w) => w.id === id)?.title || id;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggleLock} className={`btn-secondary !px-2.5 ${locked ? "!border-accent !text-accent dark:!text-accent" : ""}`} title={locked ? "Unlock dashboard" : "Lock dashboard"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300">
              {locked ? (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>) : (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></>)}
            </svg>
          </button>
          <button onClick={() => setPickerOpen(true)} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Widgets
          </button>
          <Link to="/applications" className="btn-accent">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>New application
          </Link>
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
                {l.i !== "stats" && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
                    <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{title(l.i)}</h3>
                  </div>
                )}
                <div className={`flex-1 ${l.i === "stats" ? "p-3" : "p-4"} overflow-hidden`}>{render(l.i)}</div>
              </div>
            </div>
          ))}
        </RGL>
      </div>

      {pickerOpen && <WidgetPicker visible={visible} onToggle={toggleWidget} onReset={resetLayout} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
