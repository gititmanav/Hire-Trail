/**
 * Applications — one page, three views (List · Board · Calendar).
 *
 * This shell owns everything the views share: the page header (search, view
 * switcher, Filters, create), the URL-backed filters, display preferences,
 * page shortcuts, the create/edit dialog, the tailoring drawer, and the
 * deep links other surfaces rely on:
 *   ?new=1              open the create dialog (global "n a" shortcut)
 *   ?focus=<id>         → /applications/<id> (search, notifications, board ghosts)
 *   ?tailor=<id>        open the tailoring drawer (extension, Drafting chips)
 *   ?tailorSession=<id> resolve the session's application, then open the drawer
 *   ?stage=<Stage>      the stage filter itself (dashboard funnel)
 *
 *  The list style (Classic | Table) is a Personalize preference (useListDesign). */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import toast from "../../components/ui/toast.ts";
import { applicationsAPI, tailorAPI } from "../../utils/api.ts";
import { exportToCSV } from "../../utils/csv.ts";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { usePersistentState, oneOf, isBoolean } from "../../hooks/usePersistentState.ts";
import PageHeader, { CreateButton, PageBody, PageSearch, type PageSearchHandle } from "../../components/ui/PageHeader.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import Toggle from "../../components/ui/Toggle.tsx";
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
import { useAllApplications, useApplicationsPage, useFilterOptions, useResumes } from "./data/queries.ts";
import { DEFAULT_COLUMN_ORDER, OPTIONAL_COLUMNS, isColumnOrder, type ColumnId, type TableGrouping } from "./views/table/columns.ts";
import ColumnsMenu from "./views/table/ColumnsMenu.tsx";
import type { Application } from "../../types";
import { DEFAULT_SHOW, isCalendarShow, type CalendarShow } from "./views/calendar/data.ts";

export type Density = "comfortable" | "compact";

export interface ApplicationsShell {
  design: ListDesign;
  density: Density;
  groupByCompany: boolean;
  tableGrouping: TableGrouping;
  hiddenColumns: ColumnId[];
  /** Table: the optional columns' order (also their fit priority). */
  columnOrder: ColumnId[];
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

export default function ApplicationsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isEnabled } = useFeatureFlags();
  const { filters, page, setFilters, resetFilters, filterSearch } = useApplicationFilters();
  const view = viewFromPath(location.pathname);

  /* ─── Preferences ─── */
  const [design] = useListDesign();
  const [density, setDensity] = usePersistentState<Density>("hiretrail-apps-density", "comfortable", oneOf(["comfortable", "compact"] as const));
  const [groupByCompany, setGroupByCompany] = usePersistentState<boolean>("hiretrail-apps-group-by-company-v2", false, isBoolean);
  const [tableGrouping, setTableGrouping] = usePersistentState<TableGrouping>("hiretrail-apps-table-grouping", "stage", oneOf(["stage", "company", "none"] as const));
  const [columnOrder, setColumnOrder] = usePersistentState<ColumnId[]>("hiretrail-apps-table-column-order", DEFAULT_COLUMN_ORDER, isColumnOrder);
  const [calendarShow, setCalendarShow] = usePersistentState<CalendarShow>("hiretrail-cal-show", DEFAULT_SHOW, isCalendarShow);
  const [hiddenColumns, setHiddenColumns] = usePersistentState<ColumnId[]>(
    "hiretrail-apps-table-hidden-columns", [],
    (v): v is ColumnId[] => Array.isArray(v) && v.every((c) => OPTIONAL_COLUMNS.some((o) => o.id === c)),
  );

  /* ─── Dialogs ─── */
  const [editing, setEditing] = useState<Application | null | undefined>(undefined); // undefined = closed, null = create
  const [tailorAppId, setTailorAppId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  /* ─── Data for the header + Filters panel (shares the active view's cache) ─── */
  const listParams = useMemo(() => toListParams(filters), [filters]);
  const usesPaged = view === "list" && design === "classic";
  const paged = useApplicationsPage(listParams, page, { enabled: usesPaged });
  const all = useAllApplications(listParams, { enabled: !usesPaged && view !== "calendar" });
  const source = usesPaged ? paged.data : all.data;
  const { data: filterOptions } = useFilterOptions(filters.status === "archived" ? "true" : "false");
  const { data: resumes = [] } = useResumes();

  const tabCounts = source?.tabCounts;
  const stageCounts = useMemo(() => {
    if (usesPaged) return paged.data?.stageCounts;
    // The "all" list is fetched without the stage filter; count client-side.
    const counts: Record<string, number> = {};
    for (const a of all.data?.data ?? []) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return counts;
  }, [usesPaged, paged.data, all.data]);

  const meta = view === "calendar" || !tabCounts
    ? undefined
    : filters.status === "archived" ? `${tabCounts.archived} archived` : `${tabCounts.active} active`;

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
      tailorAPI.get(session)
        .then((s) => { if (s?.applicationId) setTailorAppId(s.applicationId); })
        .catch(() => toast.error("That tailoring session no longer exists."));
    }
    const focus = take("focus");
    if (focus) {
      navigate(`/applications/${focus}`, { replace: true });
      return;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, navigate]);

  /* ─── Page shortcuts ─── */
  const views = VIEWS.filter((v) => v.key !== "board" || isEnabled("feature_kanban"));
  usePageShortcuts({
    "/": () => searchRef.current?.focus(),
    f: () => setFiltersOpen(true),
    c: () => create(),
    ...Object.fromEntries(views.map((v) => [v.shortcut, () => navigate({ pathname: v.path, search: filterSearch })])),
  });

  /* ─── Export (exactly what's filtered) ─── */
  const handleExport = async () => {
    const id = toast.loading("Preparing export…");
    try {
      const res = await applicationsAPI.getAll({ ...listParams, page: 1, limit: 1000 });
      exportToCSV(res.data);
      toast.success(`Exported ${res.data.length} application${res.data.length === 1 ? "" : "s"}`, { id });
    } catch {
      toast.error("Export failed. Please try again.", { id });
    }
  };

  /* ─── Reset: every filter + the current view's display options ─── */
  const displayChanged =
    view === "calendar" ? !(calendarShow.deadline && calendarShow.applied && calendarShow.stage)
    : view === "list" && design === "classic" ? density !== "comfortable" || groupByCompany
    : view === "list" ? tableGrouping !== "stage" || hiddenColumns.length > 0 || columnOrder.join() !== DEFAULT_COLUMN_ORDER.join()
    : false;
  const canReset = filtersChanged(filters) || displayChanged;
  const resetAll = () => {
    resetFilters();
    if (view === "calendar") setCalendarShow(DEFAULT_SHOW);
    else if (view === "list" && design === "classic") { setDensity("comfortable"); setGroupByCompany(false); }
    else if (view === "list") { setTableGrouping("stage"); setHiddenColumns([]); setColumnOrder(DEFAULT_COLUMN_ORDER); }
  };

  /* ─── Display options per view ─── */
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
  } else if (view === "list" && design === "classic") {
    display = (
      <>
        <FilterRow label="Density">
          <SegmentedControl<Density> ariaLabel="Density" size="sm" value={density} onChange={setDensity}
            segments={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
        </FilterRow>
        <FilterRow label="Group by company">
          <Toggle label="Group by company" checked={groupByCompany} onChange={setGroupByCompany} />
        </FilterRow>
      </>
    );
  } else if (view === "list") {
    display = (
      <>
        <FilterRow label="Group">
          <SegmentedControl<TableGrouping> ariaLabel="Group by" size="sm" value={tableGrouping} onChange={setTableGrouping}
            segments={[{ value: "stage", label: "Stage" }, { value: "company", label: "Company" }, { value: "none", label: "None" }]} />
        </FilterRow>
        <FilterRow label="Columns">
          <ColumnsMenu order={columnOrder} hidden={hiddenColumns} onOrderChange={setColumnOrder} onHiddenChange={setHiddenColumns} />
        </FilterRow>
      </>
    );
  }

  const context: ApplicationsShell = {
    design, density, groupByCompany, tableGrouping, hiddenColumns, columnOrder,
    openCreate, openEdit, openTailor, openShortcuts, openImport,
    calendarShow, registerCalendarCreate,
  };

  // Classic keeps its original 1200px column (under a header that spans the
  // card); every other view uses the width.
  const constrained = view === "list" && design === "classic";

  // The calendar owns its height: the page never scrolls, the grid fills the card.
  const rootClass = view === "calendar" ? "flex-1 min-h-[560px] flex flex-col" : "";

  return (
    <div className={rootClass}>
      <PageHeader
        title="Applications"
        meta={meta}
        actions={
          <>
            <PageSearch ref={searchRef} value={filters.q} onChange={(q) => setFilters({ q })} placeholder="Search company or role" ariaLabel="Search applications" />
            <ViewSwitcher views={views} search={filterSearch} />
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

      {/* Board/Calendar are their own chunks — keep the header on screen while
          one loads, with a quiet view-shaped placeholder. */}
      <Suspense fallback={<div className={`${view === "calendar" ? "flex-1" : "h-[60vh]"} rounded-xl border border-border bg-card/60 animate-pulse`} aria-label="Loading view" />}>
        {constrained ? <PageBody><Outlet context={context} /></PageBody> : <Outlet context={context} />}
      </Suspense>

      {editing !== undefined && (
        <ApplicationFormModal app={editing} onClose={() => setEditing(undefined)} />
      )}
      {tailorAppId && <ApplicationTailorDrawer applicationId={tailorAppId} onClose={() => setTailorAppId(null)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={() => void qc.invalidateQueries({ queryKey: ["applications"] })} />}
    </div>
  );
}
