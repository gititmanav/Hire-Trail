import { useState, useEffect, useContext, useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { UserContext } from "../../App.tsx";
import { analyticsAPI, applicationsAPI, authAPI, contactsAPI, deadlinesAPI, resumesAPI, notificationsAPI } from "../../utils/api.ts";
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
import FollowUpWidget from "../../components/widgets/FollowUpWidget.tsx";
import GuidedTour from "../../components/GuidedTour/GuidedTour.tsx";
import { SkeletonStats, SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import type { Application, Contact, Deadline, Resume, AnalyticsData, Notification } from "../../types";
import "react-grid-layout/css/styles.css";

const RGL = WidthProvider(Responsive);
const ONBOARD_KEY = "hiretrail-onboarded";

/** Home: analytics-backed widgets in a persisted grid; optional one-time drag hint for new sessions. */
export default function Dashboard() {
  const { user, setUser } = useContext(UserContext);
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [followUpContacts, setFollowUpContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [staleApps, setStaleApps] = useState<Application[]>([]);
  const [staleBannerDismissed, setStaleBannerDismissed] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [rejectionNotifs, setRejectionNotifs] = useState<Notification[]>([]);
  const [rejectionBannerDismissed, setRejectionBannerDismissed] = useState(false);

  const handleTourComplete = useCallback(async () => {
    try {
      await authAPI.completeTour();
      if (user) setUser({ ...user, tourCompleted: true });
    } catch {}
  }, [user, setUser]);
  const { layout, visible, locked, onLayoutChange, toggleWidget, toggleLock, resetLayout } = useWidgetLayout(user?._id);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARD_KEY)) {
      setShowOnboarding(true);
      const timer = setTimeout(() => {
        localStorage.setItem(ONBOARD_KEY, "true");
        setShowOnboarding(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [a, ap, dl, r, ct] = await Promise.all([
          analyticsAPI.get(),
          applicationsAPI.getAll({ limit: 8, sort: "createdAt", order: "desc" }),
          deadlinesAPI.getAll({ limit: 100, status: "upcoming" }),
          resumesAPI.getAll(),
          contactsAPI.getAll({ limit: 100 }),
        ]);
        setStats(a); setApps(ap.data); setResumes(r);

        // Filter contacts needing follow-up
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const needsFollowUp = ct.data.filter((c: Contact) => {
          if (c.nextFollowUpDate) {
            const due = new Date(c.nextFollowUpDate); due.setHours(0, 0, 0, 0);
            if (due.getTime() <= now.getTime()) return true;
          }
          if (c.outreachStatus === "reached_out" && c.lastOutreachDate) {
            if (new Date(c.lastOutreachDate).getTime() < sevenDaysAgo) return true;
          }
          return false;
        });
        setFollowUpContacts(needsFollowUp);

        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const stale = ap.data.filter((app) => {
          if (app.archived || app.stage === "Offer") return false;
          const lastActivity = app.stageHistory.length > 0
            ? Math.max(...app.stageHistory.map((e) => new Date(e.date).getTime()))
            : new Date(app.createdAt).getTime();
          return lastActivity < ninetyDaysAgo;
        });
        setStaleApps(stale);

        // Compare dates as YYYY-MM-DD strings to avoid timezone shifts
        const todayStr = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" format
        setDeadlines(
          dl.data.filter((d) => {
            if (d.completed) return false;
            const dueStr = d.dueDate.slice(0, 10); // "YYYY-MM-DD" from ISO string
            return dueStr >= todayStr;
          })
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 8)
        );
        // Fetch recent rejection notifications
        try {
          const notifs = await notificationsAPI.getAll({ limit: 10 });
          const unreadRejections = notifs.data.filter((n) => n.type === "rejection_detected" && !n.read);
          setRejectionNotifs(unreadRejections);
        } catch {}
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="fade-up"><SkeletonStats /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4"><SkeletonTable /><SkeletonTable rows={4} /></div></div>;

  const handleFollowUp = async (id: string) => {
    try {
      await contactsAPI.update(id, { lastOutreachDate: new Date().toISOString(), nextFollowUpDate: "" } as any);
      setFollowUpContacts((prev) => prev.filter((c) => c._id !== id));
      toast.success("Marked as followed up");
    } catch { toast.error("Failed to update contact"); }
  };

  const handleSnooze = async (id: string) => {
    try {
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 3);
      await contactsAPI.update(id, { nextFollowUpDate: snoozeDate.toISOString().split("T")[0] } as any);
      setFollowUpContacts((prev) => prev.filter((c) => c._id !== id));
      toast.success("Snoozed for 3 days");
    } catch { toast.error("Failed to snooze"); }
  };

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
      case "follow-ups": return <FollowUpWidget contacts={followUpContacts} onFollowUp={handleFollowUp} onSnooze={handleSnooze} />;
      default: return null;
    }
  };

  const title = (id: string) => ALL_WIDGETS.find((w) => w.id === id)?.title || id;

  return (
    <div className="fade-up">
      {showOnboarding && !locked && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in" style={{ animation: "fadeSlideUp 0.4s ease-out, fadeSlideUp 0.4s ease-out 3s reverse forwards" }}>
          <div className="flex items-center gap-2">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary"><path d="M14 2H6a2 2 0 00-2 2v16l5-3 5 3V4a2 2 0 00-2-2z"/></svg>
            Tip: You can drag and resize these widgets!
          </div>
        </div>
      )}

      {staleApps.length > 0 && !staleBannerDismissed && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-5 py-3 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0"><circle cx="9" cy="9" r="8"/><line x1="9" y1="5" x2="9" y2="9"/><line x1="9" y1="12" x2="9" y2="12"/></svg>
            <span>You have {staleApps.length} application{staleApps.length > 1 ? "s" : ""} with no activity in 90+ days.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={archiving}
              onClick={async () => {
                setArchiving(true);
                try {
                  await Promise.all(staleApps.map((a) => applicationsAPI.archive(a._id, "auto_stale")));
                  toast.success(`Archived ${staleApps.length} stale application${staleApps.length > 1 ? "s" : ""}`);
                  setStaleApps([]);
                } catch {
                  toast.error("Failed to archive some applications");
                } finally { setArchiving(false); }
              }}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {archiving ? "Archiving..." : "Archive all"}
            </button>
            <button onClick={() => setStaleBannerDismissed(true)} className="px-3 py-1 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {rejectionNotifs.length > 0 && !rejectionBannerDismissed && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 px-5 py-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0"><circle cx="9" cy="9" r="8"/><line x1="9" y1="5" x2="9" y2="9"/><line x1="9" y1="12" x2="9" y2="12"/></svg>
            <span>{rejectionNotifs.length} rejection{rejectionNotifs.length > 1 ? "s" : ""} auto-detected: {rejectionNotifs.map((n) => n.title.replace("Rejection detected: ", "")).join(", ")}</span>
          </div>
          <button
            onClick={async () => {
              setRejectionBannerDismissed(true);
              try { await notificationsAPI.markAllRead(); } catch {}
            }}
            className="px-3 py-1 text-xs font-medium rounded-lg border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button data-tour="lock-btn" onClick={toggleLock} className={`btn-secondary !px-2.5 ${locked ? "!border-primary !text-primary dark:!text-primary" : ""}`} title={locked ? "Unlock dashboard" : "Lock dashboard"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300">
              {locked ? (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>) : (<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></>)}
            </svg>
          </button>
          <button data-tour="widgets-btn" onClick={() => setPickerOpen(true)} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Widgets
          </button>
          <Link to="/applications" className="btn-accent">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>New application
          </Link>
        </div>
      </div>

      <div className={locked ? "dashboard-locked" : "dashboard-unlocked"}>
        <RGL className="dashboard-grid" layouts={{ lg: layout }} breakpoints={{ lg: 1024, md: 768, sm: 480 }} cols={{ lg: 12, md: 8, sm: 4 }} rowHeight={50} onLayoutChange={(nl) => onLayoutChange(nl)} isDraggable={!locked} isResizable={!locked} margin={[16, 16]} containerPadding={[0, 0]}>
          {layout.filter((l) => visible[l.i]).map((l, idx) => (
            <div key={l.i} className={showOnboarding && idx === 0 ? "onboard-hint" : ""}>
              <div className="card-premium h-full flex flex-col">
                {l.i !== "stats" && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                    <h3 className="text-[13px] font-semibold text-foreground">{title(l.i)}</h3>
                  </div>
                )}
                <div className={`flex-1 ${l.i === "stats" ? "p-3" : "p-4"} overflow-hidden`}>{render(l.i)}</div>
              </div>
            </div>
          ))}
        </RGL>
      </div>

      {pickerOpen && <WidgetPicker visible={visible} onToggle={toggleWidget} onReset={resetLayout} onClose={() => setPickerOpen(false)} />}
      {user && <GuidedTour user={user} onComplete={handleTourComplete} />}
    </div>
  );
}
