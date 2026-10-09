/**
 * Applications — one page, three views (List · Board · Calendar).
 *
 * This shell owns everything the views share: the page header (search, view
 * switcher, Sweep, Filters, create), the URL-backed filters, display
 * preferences, page shortcuts, the create/edit dialog, the tailoring drawer,
 * and the deep links other surfaces rely on:
 *   ?new=1              open the create dialog (global "n a" shortcut)
 *   ?focus=<id>         → the application (search, notifications)
 *   ?tailor=<id>        open the tailoring drawer (extension, Drafting chips)
 *   ?tailorSession=<id> resolve the session's application, then open the drawer
 *   ?stage=<Stage>      the stage filter itself (dashboard funnel)
 *   ?app=<id>[&full=1]  the Desk's open application (and whether it fills the page)
 *
 * The List view reads one of three ways — Ledger, Trail or Desk — a
 * Personalize preference (useListDesign).
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Hourglass } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { applicationsAPI, tailorAPI } from "../../utils/api.ts";
import { exportToCSV } from "../../utils/csv.ts";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { usePersistentState, oneOf } from "../../hooks/usePersistentState.ts";
import PageHeader, { CreateButton, HeaderIconButton, PageSearch, type PageSearchHandle } from "../../components/ui/PageHeader.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import { useFillHeight } from "../../components/Layout/fillHeight.ts";
import { ViewSwitcher, VIEWS, type ViewKey } from "./components/HeaderControls.tsx";
import { useListDesign } from "../../hooks/useListDesign.ts";
import type { ListDesign } from "../../utils/preferences.ts";
import FiltersMenu from "./components/FiltersMenu.tsx";
import { FilterRow } from "../../components/ui/FiltersPopover.tsx";
import ApplicationFormModal from "./components/ApplicationFormModal.tsx";
import ShortcutsModal from "./components/ShortcutsModal.tsx";
import ApplicationTailorDrawer from "./ApplicationTailorDrawer.tsx";
import ImportModal from "../../components/ImportModal/ImportModal.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationFilters, toListParams, filtersChanged } from "./data/filters.ts";
import { appKeys, LIST_CAP, useAllApplications, useFilterOptions, useInsights, useResumes } from "./data/queries.ts";
import { applicationHref } from "./data/navigation.ts";
import type { RowOrder } from "./data/focus.ts";
import { DEFAULT_COLUMN_ORDER, OPTIONAL_COLUMNS, isColumnOrder, type ColumnId } from "./views/ledger/columns.ts";
import ColumnsMenu from "./views/ledger/ColumnsMenu.tsx";
import type { Application } from "../../types";
import { DEFAULT_SHOW, isCalendarShow, type CalendarShow } from "./views/calendar/data.ts";

// Sweep is a dialog with its own motion — it loads when first opened.
const SweepModal = lazy(() => import("./sweep/SweepModal.tsx"));

/** Ledger groups. */
export type LedgerGrouping = "stage" | "momentum" | "company" | "none";
/** Trail and Desk sections. */
export type TimeGrouping = "momentum" | "stage";

export interface ApplicationsShell {
  design: ListDesign;
  ledgerGrouping: LedgerGrouping;
  ledgerOrder: RowOrder;
  hiddenColumns: ColumnId[];
  /** Ledger: the optional columns' order (also their fit priority). */
  columnOrder: ColumnId[];
  trailGrouping: TimeGrouping;
  deskGrouping: TimeGrouping;
  openCreate: () => void;
  openEdit: (app: Application) => void;
  openTailor: (applicationId: string) => void;
  openShortcuts: () => void;
  openImport: () => void;
  /** Calendar: which kinds of event show (Display options). */
  calendarShow: CalendarShow;
  /** Calendar: what "create" does there (a new deadline on the focused day). */
  registerCalendarCreate: (fn: (() => void) | null) => void;
}

export function useApplicationsShell() {
  return useOutletContext<ApplicationsShell>();
}

function viewFromPath(pathname: string): ViewKey {
  if (pathname.startsWith("/applications/board")) return "board";
  if (pathname.startsWith("/applications/calendar")) return "calendar";
  return "list";
}

const LEDGER_GROUPINGS = ["stage", "momentum", "company", "none"] as const;
const TIME_GROUPINGS = ["momentum", "stage"] as const;
const ROW_ORDERS = ["smart", "applied", "fit", "company"] as const;

export default function ApplicationsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isEnabled } = useFeatureFlags();
  const { filters, setFilters, resetFilters, filterSearch } = useApplicationFilters();
  const view = viewFromPath(location.pathname);
  const [design] = useListDesign();

  /* ─── Preferences (this device) ─── */
  const [ledgerGrouping, setLedgerGrouping] = usePersistentState<LedgerGrouping>("hiretrail-apps-table-grouping", "stage", oneOf(LEDGER_GROUPINGS));
  const [ledgerOrder, setLedgerOrder] = usePersistentState<RowOrder>("hiretrail-apps-ledger-order", "smart", oneOf(ROW_ORDERS));
  const [columnOrder, setColumnOrder] = usePersistentState<ColumnId[]>("hiretrail-apps-table-column-order", DEFAULT_COLUMN_ORDER, isColumnOrder);
  const [hiddenColumns, setHiddenColumns] = usePersistentState<ColumnId[]>(
    "hiretrail-apps-table-hidden-columns", [],
    (v): v is ColumnId[] => Array.isArray(v) && v.every((c) => OPTIONAL_COLUMNS.some((o) => o.id === c)),
  );
  const [trailGrouping, setTrailGrouping] = usePersistentState<TimeGrouping>("hiretrail-apps-trail-grouping", "momentum", oneOf(TIME_GROUPINGS));
  const [deskGrouping, setDeskGrouping] = usePersistentState<TimeGrouping>("hiretrail-apps-desk-grouping", "momentum", oneOf(TIME_GROUPINGS));
  const [calendarShow, setCalendarShow] = usePersistentState<CalendarShow>("hiretrail-cal-show", DEFAULT_SHOW, isCalendarShow);

  /* ─── Dialogs ─── */
  const [editing, setEditing] = useState<Application | null | undefined>(undefined); // undefined = closed, null = create
  const [tailorAppId, setTailorAppId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);
  const qc = useQueryClient();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<PageSearchHandle>(null);

  const openCreate = useCallback(() => setEditing(null), []);
  const openEdit = useCallback((app: Application) => setEditing(app), []);
  const openTailor = useCallback((id: string) => setTailorAppId(id), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const openImport = useCallback(() => setImportOpen(true), []);
  // In the Calendar view "create" means a new deadline; the view registers how.
  const calendarCreate = useRef<(() => void) | null>(null);
  const registerCalendarCreate = useCallback((fn: (() => void) | null) => { calendarCreate.current = fn; }, []);
  const create = useCallback(() => {
    if (view === "calendar" && calendarCreate.current) calendarCreate.current();
    else openCreate();
  }, [view, openCreate]);

  /* ─── Data for the header + Filters panel (the views share this cache) ─── */
  const listParams = useMemo(() => toListParams(filters), [filters]);
  const all = useAllApplications(listParams, { enabled: view !== "calendar" });
  const { data: filterOptions } = useFilterOptions(filters.status === "archived" ? "true" : "false");
  const { data: resumes = [] } = useResumes();
  const { data: insights } = useInsights();
  const tabCounts = all.data?.tabCounts;
  // The server counts every match (not just the 1,000 a list carries).
  const stageCounts = all.data?.stageCounts;

  const meta = view === "calendar" || !tabCounts
    ? undefined
    : filters.status === "archived" ? `${tabCounts.archived} archived` : `${tabCounts.active} active`;

  /* ─── Height: the calendar and the Desk own theirs ─── */
  const fills = view === "calendar" || (view === "list" && design === "desk");
  useFillHeight(fills);

  /* ─── Deep links ─── */
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const take = (k: string) => { const v = next.get(k); if (v != null) { next.delete(k); changed = true; } return v; };

    if (take("new") === "1") setEditing(null);
    const tailor = take("tailor");
    if (tailor) setTailorAppId(tailor);
    const session = take("tailorSession");
    if (session) {
      tailorAPI.get(session, { quiet: true })
        .then((s) => { if (s?.applicationId) setTailorAppId(s.applicationId); })
        .catch(() => toast.error("That tailoring session no longer exists."));
    }
    const focus = take("focus");
    if (focus) {
      navigate(applicationHref(focus, design, filterSearch), { replace: true });
      return;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, navigate, design, filterSearch]);

  /* ─── Page shortcuts ─── */
  const views = VIEWS.filter((v) => v.key !== "board" || isEnabled("feature_kanban"));
  usePageShortcuts({
    "/": () => searchRef.current?.focus(),
    f: () => setFiltersOpen(true),
    c: () => create(),
    ...Object.fromEntries(views.map((v) => [v.shortcut, () => navigate({ pathname: v.path, search: filterSearch })])),
  });

  /* ─── Export: everything that matches, a page of 1,000 at a time ─── */
  const handleExport = async () => {
    const id = toast.loading("Preparing export…");
    try {
      const rows: Application[] = [];
      for (let page = 1; ; page++) {
        const res = await applicationsAPI.getAll({ ...listParams, page, limit: LIST_CAP }, { quiet: true });
        rows.push(...res.data);
        if (page >= res.pagination.pages || res.data.length === 0) break;
      }
      exportToCSV(rows);
      toast.success(`Exported ${rows.length.toLocaleString()} application${rows.length === 1 ? "" : "s"}`, { id });
    } catch {
      toast.error("Export failed. Please try again.", { id });
    }
  };

  /* ─── Reset: every filter + the current view's display options ─── */
  const listView = view === "list";
  const displayChanged =
    view === "calendar" ? !(calendarShow.deadline && calendarShow.applied && calendarShow.stage)
    : listView && design === "ledger" ? ledgerGrouping !== "stage" || ledgerOrder !== "smart" || hiddenColumns.length > 0 || columnOrder.join() !== DEFAULT_COLUMN_ORDER.join()
    : listView && design === "trail" ? trailGrouping !== "momentum"
    : listView && design === "desk" ? deskGrouping !== "momentum"
    : false;
  const canReset = filtersChanged(filters) || displayChanged;
  const resetAll = () => {
    resetFilters();
    if (view === "calendar") setCalendarShow(DEFAULT_SHOW);
    else if (listView && design === "ledger") { setLedgerGrouping("stage"); setLedgerOrder("smart"); setHiddenColumns([]); setColumnOrder(DEFAULT_COLUMN_ORDER); }
    else if (listView && design === "trail") setTrailGrouping("momentum");
    else if (listView && design === "desk") setDeskGrouping("momentum");
  };

  /* ─── Display options per view ─── */
  const timeGroupingRow = (value: TimeGrouping, onChange: (g: TimeGrouping) => void) => (
    <FilterRow label="Group">
      <SegmentedControl<TimeGrouping> ariaLabel="Group by" size="sm" value={value} onChange={onChange}
        segments={[{ value: "momentum", label: "Momentum" }, { value: "stage", label: "Stage" }]} />
    </FilterRow>
  );
  let display: React.ReactNode = null;
  if (view === "calendar") {
    const kinds: { key: keyof CalendarShow; label: string }[] = [
      { key: "deadline", label: "Deadlines" }, { key: "applied", label: "Applied" }, { key: "stage", label: "Stage changes" },
    ];
    display = (
      <div className="px-2.5 pt-1.5 pb-1">
        <span className="block text-[13px] text-foreground mb-2">Show</span>
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => {
            const on = calendarShow[k.key];
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={on}
                onClick={() => setCalendarShow({ ...calendarShow, [k.key]: !on })}
                className={`h-7 px-2.5 rounded-full text-[12px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "bg-control border-border text-foreground" : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (listView && design === "ledger") {
    display = (
      <>
        <FilterRow label="Group">
          <SegmentedControl<LedgerGrouping> ariaLabel="Group by" size="sm" value={ledgerGrouping} onChange={setLedgerGrouping}
            segments={[{ value: "stage", label: "Stage" }, { value: "momentum", label: "Momentum" }, { value: "company", label: "Company" }, { value: "none", label: "None" }]} />
        </FilterRow>
        <FilterRow label="Order">
          <SegmentedControl<RowOrder> ariaLabel="Order rows by" size="sm" value={ledgerOrder} onChange={setLedgerOrder}
            segments={[{ value: "smart", label: "Next up" }, { value: "applied", label: "Applied" }, { value: "fit", label: "Fit" }, { value: "company", label: "A–Z" }]} />
        </FilterRow>
        <FilterRow label="Columns">
          <ColumnsMenu order={columnOrder} hidden={hiddenColumns} onOrderChange={setColumnOrder} onHiddenChange={setHiddenColumns} />
        </FilterRow>
      </>
    );
  } else if (listView && design === "trail") {
    display = timeGroupingRow(trailGrouping, setTrailGrouping);
  } else if (listView && design === "desk") {
    display = timeGroupingRow(deskGrouping, setDeskGrouping);
  }

  const context: ApplicationsShell = {
    design, ledgerGrouping, ledgerOrder, hiddenColumns, columnOrder, trailGrouping, deskGrouping,
    openCreate, openEdit, openTailor, openShortcuts, openImport,
    calendarShow, registerCalendarCreate,
  };

  const sweepCount = insights?.sweepCount ?? 0;

  return (
    <div className={fills ? "flex-1 min-h-[560px] flex flex-col" : ""}>
      <PageHeader
        title="Applications"
        meta={meta}
        actions={
          <>
            <PageSearch ref={searchRef} value={filters.q} onChange={(q) => setFilters({ q })} placeholder="Search company or role" ariaLabel="Search applications" />
            <ViewSwitcher views={views} search={filterSearch} />
            {sweepCount > 0 && (
              <HeaderIconButton
                label={`${sweepCount} quiet past your reply window — sweep them`}
                onClick={() => setSweepOpen(true)}
                className="!w-auto px-2 gap-1.5"
              >
                <Hourglass size={14} strokeWidth={1.9} aria-hidden />
                <span className="text-[12.5px] font-semibold tabular-nums text-foreground">{sweepCount > 99 ? "99+" : sweepCount}</span>
              </HeaderIconButton>
            )}
            <FiltersMenu
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              filters={filters}
              setFilters={setFilters}
              onReset={resetAll}
              canReset={canReset}
              tabCounts={tabCounts}
              stageCounts={stageCounts}
              showStage={view !== "board"}
              options={filterOptions}
              resumes={resumes}
              display={display}
              onExport={handleExport}
              onShortcuts={openShortcuts}
            />
            <CreateButton onClick={create} label={view === "calendar" ? "New deadline" : "New application"} />
          </>
        }
      />

      {/* Board/Calendar/Trail/Desk are their own chunks — keep the header on
          screen while one loads, with a quiet view-shaped placeholder. */}
      <Suspense fallback={<div className={`${fills ? "flex-1" : "h-[60vh]"} rounded-xl bg-muted/50 animate-pulse`} aria-label="Loading view" />}>
        <Outlet context={context} />
      </Suspense>

      {editing !== undefined && (
        <ApplicationFormModal app={editing} onClose={() => setEditing(undefined)} />
      )}
      {tailorAppId && <ApplicationTailorDrawer applicationId={tailorAppId} onClose={() => setTailorAppId(null)} />}
      {shortcutsOpen && <ShortcutsModal design={design} onClose={() => setShortcutsOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={() => void qc.invalidateQueries({ queryKey: appKeys.all })} />}
      {sweepOpen && (
        <Suspense fallback={null}>
          <SweepModal onClose={() => setSweepOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
