import { useState, useEffect, useContext, useCallback, useMemo, lazy, Suspense } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useNavigate } from "react-router-dom";
import { Building2, Info, Lock, Unlock, LayoutGrid } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { UserContext } from "../../App.tsx";
import { applicationsAPI, authAPI, contactsAPI, deadlinesAPI, resumesAPI } from "../../utils/api.ts";
import StageSuggestionsCard from "../../components/StageSuggestionsCard/StageSuggestionsCard.tsx";
import { useWidgetLayout, ALL_WIDGETS } from "../../hooks/useWidgetLayout.ts";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus.ts";
import WidgetPicker from "../../components/WidgetPicker/WidgetPicker.tsx";
import PageHeader, { CreateButton, HeaderIconButton } from "../../components/ui/PageHeader.tsx";
import FiltersPopover, { ANY_DOT, FilterRow } from "../../components/ui/FiltersPopover.tsx";
import Select from "../../components/ui/Select.tsx";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import { useCompanies } from "../Applications/data/queries.ts";
// Chart-driven widgets bring in chart.js + react-chartjs-2 (the heaviest part
// of the Dashboard bundle). Lazy each so the Dashboard renders shell-first;
// widgets stream in as their chunks resolve. Non-chart widgets are lazied too
// for consistency — each is small but together they trim the main chunk.
const StatsWidget             = lazy(() => import("../../components/widgets/StatsWidget.tsx"));
const FunnelWidget            = lazy(() => import("../../components/widgets/FunnelWidget.tsx"));
const ConversionWidget        = lazy(() => import("../../components/widgets/ConversionWidget.tsx"));
const TrendWidget             = lazy(() => import("../../components/widgets/TrendWidget.tsx"));
const PieWidget               = lazy(() => import("../../components/widgets/PieWidget.tsx"));
const ResumePerformanceWidget = lazy(() => import("../../components/widgets/ResumePerformanceWidget.tsx"));
const RecentAppsWidget        = lazy(() => import("../../components/widgets/RecentAppsWidget.tsx"));
const DeadlinesWidget         = lazy(() => import("../../components/widgets/DeadlinesWidget.tsx"));
const FollowUpWidget          = lazy(() => import("../../components/widgets/FollowUpWidget.tsx"));
const DashboardCalendarCard   = lazy(() => import("../../components/widgets/DashboardCalendarCard.tsx"));
import GuidedTour from "../../components/GuidedTour/GuidedTour.tsx";
import { SkeletonStats, SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import { STAGES, STAGE_STRIPE_CLASS } from "../../utils/stageStyles.ts";
import { buildAnalyticsFromApplications, filterDashboardApplications, getCompanyCounts, getDashboardCompanies, getRecentApplications, getStageCounts } from "../../utils/dashboardInsights.ts";
import { dayOf, todayYmd } from "../../utils/dates.ts";
import { computeActivityStreak, computeWeeklyCapacity } from "../../utils/dashboardSignals.ts";
import StreakCard from "./components/StreakCard.tsx";
import WeeklyCapacityCard from "./components/WeeklyCapacityCard.tsx";
import type { Application, Contact, Deadline, Resume, AnalyticsData, Stage } from "../../types";
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
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [selectedStage, setSelectedStage] = useState<Stage | "All">("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();

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
      if (!locked) toast("Tip: you can drag and resize these widgets.", { id: "dashboard-tip", duration: 3500 });
      const timer = setTimeout(() => {
        localStorage.setItem(ONBOARD_KEY, "true");
        setShowOnboarding(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [ap, r, ct] = await Promise.all([
        applicationsAPI.getAll({ limit: 1000, sort: "createdAt", order: "desc", archived: "all", fields: "summary" }),
        resumesAPI.getAll(),
        contactsAPI.getAll({ limit: 100 }),
      ]);
      const dlAll = await deadlinesAPI.getAllAggregated({ status: "all" });
      const allApps = ap.data;
      setStats(buildAnalyticsFromApplications(allApps));
      setApps(allApps);
      setResumes(r);

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
      const stale = allApps.filter((app) => {
        if (app.archived || app.stage === "Offer") return false;
        const lastActivity = app.stageHistory.length > 0
          ? Math.max(...app.stageHistory.map((e) => new Date(e.date).getTime()))
          : new Date(app.createdAt).getTime();
        return lastActivity < ninetyDaysAgo;
      });
      setStaleApps(stale);

      // Due days as YYYY-MM-DD strings (utils/dates.ts) — no timezone shifts.
      const todayStr = todayYmd();
      setDeadlines(
        dlAll.filter((d) => !d.completed && dayOf(d.dueDate) >= todayStr)
          .sort((a, b) => (dayOf(a.dueDate) < dayOf(b.dueDate) ? -1 : dayOf(a.dueDate) > dayOf(b.dueDate) ? 1 : 0)).slice(0, 8)
      );
    } catch { /* swallow */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useRefetchOnFocus(loadData);

  const companyOptions = useMemo(() => getDashboardCompanies(apps), [apps]);
  const companyCounts = useMemo(() => getCompanyCounts(apps), [apps]);
  // Logos for the company filter (shared, cached query — same list Applications uses).
  const { data: companies = [] } = useCompanies();
  const logoByName = useMemo(() => new Map(companies.map((c) => [c.name.toLowerCase(), c.logoUrl])), [companies]);
  const stageCounts = useMemo(() => getStageCounts(apps, selectedCompany), [apps, selectedCompany]);
  const filteredApps = useMemo(
    () => filterDashboardApplications(apps, { company: selectedCompany, stage: selectedStage }),
    [apps, selectedCompany, selectedStage]
  );

  /* `nowTick` is bumped once per minute so streak / weekly-capacity
   *  recompute across the midnight rollover during a long session. */
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const streak = useMemo(() => computeActivityStreak(apps, nowTick), [apps, nowTick]);
  const weeklyCapacity = useMemo(() => computeWeeklyCapacity(apps, 10, nowTick), [apps, nowTick]);
  const filteredStats = useMemo(() => buildAnalyticsFromApplications(filteredApps), [filteredApps]);
  const filteredRecentApps = useMemo(() => getRecentApplications(filteredApps), [filteredApps]);
  const activeStats: AnalyticsData = selectedCompany === "All" && selectedStage === "All" && stats ? stats : filteredStats;

  const createApplication = () => navigate("/applications?new=1");
  usePageShortcuts({ f: () => setFiltersOpen(true), c: createApplication });

  const filtered = selectedCompany !== "All" || selectedStage !== "All";
  const header = (
    <PageHeader
      title="Dashboard"
      meta={filtered ? [selectedCompany !== "All" && selectedCompany, selectedStage !== "All" && selectedStage].filter(Boolean).join(" · ") : undefined}
      actions={
        <>
          <FiltersPopover
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            active={(selectedCompany !== "All" ? 1 : 0) + (selectedStage !== "All" ? 1 : 0)}
            canReset={filtered}
            onReset={() => { setSelectedCompany("All"); setSelectedStage("All"); }}
            filters={
              <>
                <FilterRow label="Company">
                  <Select
                    variant="pill"
                    ariaLabel="Company"
                    searchable
                    searchPlaceholder="Search companies…"
                    value={selectedCompany}
                    onChange={setSelectedCompany}
                    options={[
                      { value: "All", label: `All companies · ${apps.length}`, icon: <Building2 size={14} strokeWidth={1.7} className="text-muted-foreground" /> },
                      ...companyOptions.map((company) => ({
                        value: company,
                        label: `${company} · ${companyCounts.get(company) ?? 0}`,
                        icon: <CompanyLogo name={company} logoUrl={logoByName.get(company.toLowerCase())} size="2xs" />,
                      })),
                    ]}
                  />
                </FilterRow>
                <FilterRow label="Stage">
                  <Select
                    variant="pill"
                    ariaLabel="Stage"
                    value={selectedStage}
                    onChange={(v) => setSelectedStage(v as Stage | "All")}
                    options={[
                      { value: "All", label: `All stages · ${STAGES.reduce((n, stage) => n + stageCounts[stage], 0)}`, icon: ANY_DOT },
                      ...STAGES.map((stage) => ({ value: stage, label: `${stage} · ${stageCounts[stage]}`, icon: <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[stage]}`} /> })),
                    ]}
                  />
                </FilterRow>
              </>
            }
          />
          <HeaderIconButton data-tour="lock-btn" label={locked ? "Unlock dashboard" : "Lock dashboard"} active={locked} onClick={toggleLock}>
            {locked ? <Lock size={15} strokeWidth={1.8} aria-hidden /> : <Unlock size={15} strokeWidth={1.8} aria-hidden />}
          </HeaderIconButton>
          <HeaderIconButton data-tour="widgets-btn" label="Widgets" onClick={() => setPickerOpen(true)}>
            <LayoutGrid size={15} strokeWidth={1.8} aria-hidden />
          </HeaderIconButton>
          <CreateButton onClick={createApplication} label="New application" />
        </>
      }
    />
  );

  if (loading) return <div>{header}<SkeletonStats /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4"><SkeletonTable /><SkeletonTable rows={4} /></div></div>;

  const handleFollowUp = async (id: string) => {
    try {
      // Clear nextFollowUpDate with null (not "") so the backend stores a
      // proper unset value — empty string would persist and slip past the
      // `if (c.nextFollowUpDate)` filters used elsewhere.
      await contactsAPI.update(id, { lastOutreachDate: new Date().toISOString(), nextFollowUpDate: null });
      setFollowUpContacts((prev) => prev.filter((c) => c._id !== id));
      toast.success("Marked as followed up");
    } catch { toast.error("Failed to update contact"); }
  };

  const handleSnooze = async (id: string) => {
    try {
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 3);
      await contactsAPI.update(id, { nextFollowUpDate: snoozeDate.toISOString().split("T")[0] });
      setFollowUpContacts((prev) => prev.filter((c) => c._id !== id));
      toast.success("Snoozed for 3 days");
    } catch { toast.error("Failed to snooze"); }
  };

  const render = (id: string) => {
    if (!activeStats) return null;
    switch (id) {
      case "stats": return <StatsWidget data={activeStats} />;
      case "streak": return <StreakCard streak={streak} />;
      case "capacity": return <WeeklyCapacityCard thisWeek={weeklyCapacity.thisWeek} userId={user?._id} />;
      case "funnel": return <FunnelWidget data={activeStats} />;
      case "conversion": return <ConversionWidget data={activeStats} />;
      case "trend": return <TrendWidget data={activeStats} />;
      case "pie": return <PieWidget data={activeStats} />;
      case "resume-perf": return <ResumePerformanceWidget data={activeStats} resumes={resumes} />;
      case "recent-apps": return <RecentAppsWidget apps={filteredRecentApps} />;
      case "deadlines": return <DeadlinesWidget deadlines={deadlines} />;
      case "follow-ups": return <FollowUpWidget contacts={followUpContacts} onFollowUp={handleFollowUp} onSnooze={handleSnooze} />;
      case "mini-calendar": return <DashboardCalendarCard />;
      default: return null;
    }
  };

  const title = (id: string) => ALL_WIDGETS.find((w) => w.id === id)?.title || id;

  return (
    <div>
      {header}

      {staleApps.length > 0 && !staleBannerDismissed && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-5 py-3 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Info size={18} strokeWidth={1.5} className="shrink-0" />
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
                  // Re-sync the full apps list so widgets that depend on it
                  // (Recent Applications, Funnel, etc.) reflect the archive
                  // immediately rather than waiting for the next focus refetch.
                  await loadData();
                } catch {
                  toast.error("Failed to archive some applications");
                } finally { setArchiving(false); }
              }}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {archiving ? "Archiving..." : "Archive all"}
            </button>
            <button onClick={() => setStaleBannerDismissed(true)} className="px-3 py-1 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <StageSuggestionsCard />

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
                <div className={`flex-1 ${l.i === "stats" ? "p-3" : "p-4"} overflow-hidden`}>
                  {/* Per-widget Suspense — chart-driven widgets are lazy,
                   *  so they each settle in independently rather than blocking
                   *  the whole grid behind a single boundary. Skeleton is
                   *  intentionally muted so the page renders shell-first. */}
                  <Suspense fallback={<div className="w-full h-full bg-muted/30 rounded animate-pulse" aria-label="Loading widget" />}>
                    {render(l.i)}
                  </Suspense>
                </div>
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
