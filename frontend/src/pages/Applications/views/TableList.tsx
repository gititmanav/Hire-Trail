/** Full-width table list — the "use the width with information" design.
 *
 *  One row per application; each property in its own column. Columns appear
 *  by priority as the container widens (see table/columns.ts) and can be hidden
 *  under Filters → Display. Rows group by stage (default), company, or not at
 *  all, with collapsible, counted group headers — which replaces the classic
 *  stage-chip row without losing the at-a-glance numbers.
 *
 *  Loads every matching application at once (summary payload) and shares that
 *  cache with the Board, so switching List ⇄ Board is instant. */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import { usePersistentState } from "../../../hooks/usePersistentState.ts";
import { STAGES, STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { computeAppHealth, suggestNextAction, HEALTH_DOT_CLASS } from "../../../utils/applicationHealth.ts";
import EmptyState from "../components/EmptyState.tsx";
import StageMenu from "../components/StageMenu.tsx";
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams, activeFilterCount } from "../data/filters.ts";
import { useAllApplications, useResumes, useUpcomingDeadlines } from "../data/queries.ts";
import { useMoveStage } from "../data/useMoveStage.ts";
import { useCompanyResolver, useListBehavior, useOpenApplication, useRestoreListScroll } from "./shared.tsx";
import { COLUMNS, type ColumnDef, type ColumnId } from "./table/columns.ts";
import type { Application, Company, Deadline, Resume, Stage } from "../../../types";

const GRADE_TONE: Record<string, string> = {
  A: "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:ring-emerald-800/60",
  B: "text-sky-700 bg-sky-50 ring-sky-200 dark:text-sky-300 dark:bg-sky-900/30 dark:ring-sky-800/60",
  C: "text-amber-700 bg-amber-50 ring-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:ring-amber-800/60",
  D: "text-orange-700 bg-orange-50 ring-orange-200 dark:text-orange-300 dark:bg-orange-900/30 dark:ring-orange-800/60",
  F: "text-red-700 bg-red-50 ring-red-200 dark:text-red-300 dark:bg-red-900/30 dark:ring-red-800/60",
};

const SOURCE_LABEL: Record<string, string> = { manual: "Manual", extension: "Extension", email: "Inbox scan" };

const thisYear = new Date().getFullYear();
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", d.getFullYear() === thisYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/60">{children}</span>;
}

/* ─── Row ─── */

interface RowProps {
  app: Application;
  index: number;
  columns: ColumnDef[];
  template: string;
  company?: Company;
  resume?: Resume;
  deadline?: Deadline;
  focused: boolean;
  selected: boolean;
  selectionActive: boolean;
  onOpen: (app: Application, e: React.MouseEvent) => void;
  onToggle: (id: string) => void;
  onFocus: (index: number) => void;
  onMove: (app: Application, stage: Stage) => void;
}

const TableRow = memo(function TableRow({
  app, index, columns, template, company, resume, deadline, focused, selected, selectionActive, onOpen, onToggle, onFocus, onMove,
}: RowProps) {
  const health = computeAppHealth(app);
  // Colour is reserved for real dates: a deadline due within 3 days is amber,
  // overdue is red. Suggestions ("Add a follow-up") stay neutral — when most
  // rows carry one, colouring them all would say nothing.
  const next: { text: string; tone: string } | null = deadline
    ? (() => {
        const ms = new Date(deadline.dueDate).getTime() - Date.now();
        const tone = ms < 0 ? "text-red-600 dark:text-red-400" : ms < 3 * 86_400_000 ? "text-amber-700 dark:text-amber-400" : "text-foreground/85";
        return { text: `${deadline.type} · ${shortDate(deadline.dueDate)}`, tone };
      })()
    : (() => {
        const n = suggestNextAction(app);
        return n.kind === "open" ? null : { text: n.label, tone: "text-muted-foreground" };
      })();

  const cell = (id: ColumnId): React.ReactNode => {
    switch (id) {
      case "role":
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              role="checkbox"
              aria-checked={selected}
              aria-label={`Select ${app.role} at ${app.company}`}
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onToggle(app._id); }}
              className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-opacity cursor-pointer ${
                selected ? "bg-primary border-primary opacity-100" : `border-border bg-background ${selectionActive ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`
              }`}
            >
              {selected && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-primary-foreground" aria-hidden><path d="M2.5 6.2 5 8.5 9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="xs" />
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="text-[13.5px] font-medium text-foreground truncate">{app.role}</span>
              <span className="text-[13px] text-muted-foreground truncate shrink-[2]">{app.company}</span>
            </div>
            {app.aiExtractionStatus === "processing" && <AiPulse size={12} tone="subtle" className="shrink-0" />}
          </div>
        );
      case "stage":
        return <StageMenu app={app} onMove={onMove} />;
      case "inStage":
        return (
          <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-foreground/80" title={health.longLabel}>
            <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[health.tone]}`} aria-hidden />
            {health.shortLabel}
          </span>
        );
      case "fit":
        if (app.fit?.status === "processing") return <AiPulse size={13} tone="subtle" />;
        if (app.fit?.status === "succeeded" && app.fit.fitGrade) {
          return (
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[12px] font-semibold ring-1 ring-inset ${GRADE_TONE[app.fit.fitGrade]}`} title={`Fit ${app.fit.fitGrade} · ${app.fit.fitScore}/5`}>
              {app.fit.fitGrade}
            </span>
          );
        }
        return <Muted>—</Muted>;
      case "next":
        return next ? <span className={`text-[13px] truncate ${next.tone}`}>{next.text}</span> : <Muted>—</Muted>;
      case "resume":
        return resume ? <span className="text-[13px] text-foreground/80 truncate">{resume.name}</span> : <Muted>—</Muted>;
      case "applied":
        return <span className="text-[13px] text-foreground/80 tabular-nums">{shortDate(app.applicationDate)}</span>;
      case "location":
        return app.location?.trim() ? <span className="text-[13px] text-foreground/80 truncate">{app.location}</span> : <Muted>—</Muted>;
      case "salary":
        return app.salary?.trim() ? <span className="text-[13px] text-foreground/80 truncate">{app.salary}</span> : <Muted>—</Muted>;
      case "source":
        return <span className="text-[13px] text-muted-foreground">{SOURCE_LABEL[app.source ?? "manual"] ?? "Manual"}</span>;
    }
  };

  return (
    <div
      role="row"
      data-row-index={index}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      onMouseEnter={() => onFocus(index)}
      onClick={(e) => {
        // Portaled menus bubble through React; only clicks physically inside
        // the row open it.
        if (!e.currentTarget.contains(e.target as Node)) return;
        onOpen(app, e);
      }}
      style={{ gridTemplateColumns: template, contentVisibility: "auto", containIntrinsicSize: "auto 44px" }}
      className={`group/row grid items-center gap-x-4 h-11 px-4 border-b border-border/70 cursor-pointer transition-colors outline-none ${
        selected ? "bg-primary/[0.06]" : focused ? "bg-muted/60" : "hover:bg-muted/40"
      }`}
    >
      {columns.map((c) => (
        <div key={c.id} role="cell" className={`min-w-0 flex ${c.align === "right" ? "justify-end" : ""}`}>{cell(c.id)}</div>
      ))}
    </div>
  );
});

/* ─── Group header ─── */

function GroupHeader({ label, count, collapsed, onToggle, leading }: {
  label: string; count: number; collapsed: boolean; onToggle: () => void; leading: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="w-full flex items-center gap-2 h-9 px-4 bg-muted/40 border-b border-border/70 text-left hover:bg-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <ChevronRight size={13} strokeWidth={2.2} className={`text-muted-foreground transition-transform duration-200 ${collapsed ? "" : "rotate-90"}`} aria-hidden />
      {leading}
      <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
      <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

/* ─── Skeleton ─── */

function TableSkeleton({ template }: { template: string }) {
  return (
    <div aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="grid items-center gap-x-4 h-11 px-4 border-b border-border/70" style={{ gridTemplateColumns: template }}>
          <div className="flex items-center gap-2.5"><span className="w-4" /><span className="w-6 h-6 rounded-md bg-muted animate-pulse" /><span className="h-3 rounded bg-muted animate-pulse" style={{ width: `${40 + ((i * 17) % 35)}%` }} /></div>
          <span className="h-5 w-20 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ─── Table ─── */

export default function TableList() {
  const shell = useApplicationsShell();
  const { filters, setFilters } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: resumes = [] } = useResumes();
  const { data: deadlines = [] } = useUpcomingDeadlines();
  const moveStage = useMoveStage();

  /* Width-driven columns. */
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columns = useMemo(
    () => COLUMNS.filter((c) => !c.optional || (!shell.hiddenColumns.includes(c.id) && width >= c.minWidth)),
    [shell.hiddenColumns, width],
  );
  const template = columns.map((c) => c.track).join(" ");

  /* Stage filter is applied here (the shared "all" cache is stage-less). */
  const apps = useMemo(
    () => (data?.data ?? []).filter((a) => !filters.stage || a.stage === filters.stage),
    [data, filters.stage],
  );

  /* Groups + persisted collapse state. */
  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    "hiretrail-apps-table-collapsed", [],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string"),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const toggleGroup = (key: string) => setCollapsedList(collapsed.has(key) ? collapsedList.filter((k) => k !== key) : [...collapsedList, key]);

  const groups = useMemo(() => {
    if (shell.tableGrouping === "none") return [{ key: "all", label: "", apps }];
    if (shell.tableGrouping === "stage") {
      return STAGES.map((s) => ({ key: `stage:${s}`, label: s, stage: s, apps: apps.filter((a) => a.stage === s) })).filter((g) => g.apps.length > 0);
    }
    const byCompany = new Map<string, Application[]>();
    for (const a of apps) byCompany.set(a.company, [...(byCompany.get(a.company) ?? []), a]);
    return [...byCompany.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([company, list]) => ({ key: `company:${company}`, label: company, apps: list }));
  }, [apps, shell.tableGrouping]);

  /* Visible order = what J/K and the detail page's next/prev walk. */
  const visible = useMemo(() => groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.apps)), [groups, collapsed]);
  const orderedIds = useMemo(() => visible.map((a) => a._id), [visible]);
  const open = useOpenApplication(orderedIds);
  const resolveCompany = useCompanyResolver(visible);
  const { focusedIndex, setFocusedIndex, selected, toggle, overlays } = useListBehavior({
    apps: visible, archived: filters.status === "archived", onOpen: (a) => open(a), onEdit: shell.openEdit,
  });
  useRestoreListScroll(!isPending);

  const resumeById = useMemo(() => new Map(resumes.map((r) => [r._id, r])), [resumes]);
  /** Soonest open deadline per application. */
  const nextDeadline = useMemo(() => {
    const m = new Map<string, Deadline>();
    for (const d of deadlines) {
      if (!d.applicationId || d.completed) continue;
      const cur = m.get(d.applicationId);
      if (!cur || new Date(d.dueDate) < new Date(cur.dueDate)) m.set(d.applicationId, d);
    }
    return m;
  }, [deadlines]);

  // Focus follows the list when groups collapse under the cursor.
  useEffect(() => { if (focusedIndex >= visible.length) setFocusedIndex(visible.length - 1); }, [visible.length, focusedIndex, setFocusedIndex]);

  const narrowing = activeFilterCount(filters) > 0 || !!filters.q;
  // Running index across groups, assigned in render order (matches `visible`).
  let rowIndex = -1;

  return (
    <div ref={containerRef}>
      {isPending ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden"><TableSkeleton template={template || "1fr 118px"} /></div>
      ) : apps.length === 0 ? (
        <EmptyState
          mode={narrowing || filters.status === "archived" ? "filtered" : "welcome"}
          onAddManually={shell.openCreate}
          onImport={shell.openImport}
          onClearFilters={() => setFilters({ q: "", stage: "", company: "", resume: "", source: "" })}
        />
      ) : (
        <div role="table" aria-label="Applications" aria-rowcount={apps.length} className="rounded-xl border border-border bg-card overflow-hidden">
          <div role="row" className="grid items-center gap-x-4 h-9 px-4 border-b border-border bg-card" style={{ gridTemplateColumns: template }}>
            {columns.map((c) => (
              <div key={c.id} role="columnheader" className={`text-[11.5px] font-medium text-muted-foreground ${c.id === "role" ? "pl-[26px]" : ""}`}>{c.label}</div>
            ))}
          </div>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key} role="rowgroup">
                {shell.tableGrouping !== "none" && (
                  <GroupHeader
                    label={g.label}
                    count={g.apps.length}
                    collapsed={isCollapsed}
                    onToggle={() => toggleGroup(g.key)}
                    leading={"stage" in g && g.stage
                      ? <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[g.stage as Stage]}`} aria-hidden />
                      : <CompanyLogo name={g.label} logoUrl={resolveCompany(g.apps[0])?.logoUrl} size="xs" />}
                  />
                )}
                {!isCollapsed && g.apps.map((a) => {
                  rowIndex += 1;
                  return (
                    <TableRow
                      key={a._id}
                      app={a}
                      index={rowIndex}
                      columns={columns}
                      template={template}
                      company={resolveCompany(a)}
                      resume={a.resumeId ? resumeById.get(a.resumeId) : undefined}
                      deadline={nextDeadline.get(a._id)}
                      focused={focusedIndex === rowIndex}
                      selected={selected.has(a._id)}
                      selectionActive={selected.size > 0}
                      onOpen={open}
                      onToggle={toggle}
                      onFocus={setFocusedIndex}
                      onMove={moveStage}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {data && data.data.length >= 1000 && (
        <p className="mt-3 text-[12.5px] text-muted-foreground">Showing the 1,000 most recent applications. Narrow the filters to see older ones.</p>
      )}
      {overlays}
    </div>
  );
}
