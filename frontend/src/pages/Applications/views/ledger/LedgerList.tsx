/** Ledger — the stage-aware table (List view, Personalize → Ledger).
 *
 *  One row per application. Two columns always show: who (role · company) and
 *  what it's waiting on — the focus column, which asks each stage's own
 *  question (data/focus.ts). Optional columns (stage, a ten-week trail, fit,
 *  resume, applied, location, salary, source) appear as the list widens, in
 *  the order the person chose. Groups run furthest-along first (Offer →
 *  Interview → OA → Applied → Drafting, Rejected folded), or by momentum,
 *  company, or not at all; each strip carries its summary and its own column
 *  labels and pins under the page header.
 *
 *  Click a row to open it; Space (or the chevron) peeks it open in place.
 *  Below 620px of list width a row folds into two lines. Loads every match at
 *  once (summary payload) and shares that cache with every other view. */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CompanyLogo from "../../../../components/CompanyLogo/CompanyLogo.tsx";
import Collapse from "../../../../components/ui/Collapse.tsx";
import { CheckboxMark } from "../../../../components/ui/Checkbox.tsx";
import AiPulse from "../../../../components/AiIndicator/AiPulse.tsx";
import { usePersistentState } from "../../../../hooks/usePersistentState.ts";
import { STAGE_STRIPE_CLASS } from "../../../../utils/stageStyles.ts";
import { todayYmd } from "../../../../utils/dates.ts";
import EmptyState from "../../components/EmptyState.tsx";
import StageMenu from "../../components/StageMenu.tsx";
import TrailLine from "../../components/TrailLine.tsx";
import { FitCell, OutreachTag, shortDate } from "../../components/RowBits.tsx";
import { TONE_CLASS } from "../../components/tone.ts";
import { useApplicationsShell } from "../../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams, activeFilterCount } from "../../data/filters.ts";
import { LIST_CAP, useAllApplications, useContacts, useOpenDeadlines, useReplyWindow, useResumes } from "../../data/queries.ts";
import { useMoveStage } from "../../data/useMoveStage.ts";
import {
  FOCUS_LABEL, MOMENTUM_LABEL, MOMENTUM_ORDER, PROGRESS_ORDER, momentum, momentumSummary, nextDeadlines, rowFocus,
  sortApplications, stageSummary, trailShape, type ReplyWindow,
} from "../../data/focus.ts";
import { useCompanyResolver, useListBehavior, useOpenApplication, useRestoreListScroll } from "../shared.tsx";
import { COMPACT_BELOW, PEEK_TRACK, WIDTH_STEPS, ledgerColumns, type ColumnDef, type ColumnId } from "./columns.ts";
import LedgerPeek from "./LedgerPeek.tsx";
import type { Application, Company, Contact, Deadline, Resume, Stage } from "../../../../types";

const SOURCE_LABEL: Record<string, string> = { manual: "Manual", extension: "Extension", email: "Inbox scan" };
/** The trail column's window: the last ten weeks. */
const TRAIL_WINDOW: [number, number] = [-70, 0];

/** Sticky strips pin under the page header; rows scrolled into view by the
 *  keyboard must clear both. */
const STRIP_H = 36;
const ROW_SCROLL_MARGIN = `calc(var(--page-header-h, 0px) + ${STRIP_H}px)`;

/* ─── Row ─── */

interface RowProps {
  app: Application;
  index: number;
  columns: ColumnDef[];
  template: string;
  compact: boolean;
  company?: Company;
  resume?: Resume;
  next?: Deadline;
  rw: ReplyWindow;
  today: string;
  focused: boolean;
  selected: boolean;
  selectionActive: boolean;
  peekOpen: boolean;
  contacts: Contact[];
  onOpen: (app: Application, e?: React.MouseEvent) => void;
  onToggle: (id: string) => void;
  onFocus: (index: number) => void;
  onLeave: (index: number) => void;
  onMove: (app: Application, stage: Stage) => void;
  onPeek: (id: string) => void;
  onEdit: (app: Application) => void;
  onTailor: (id: string) => void;
}

const LedgerRow = memo(function LedgerRow({
  app, index, columns, template, compact, company, resume, next, rw, today, focused, selected, selectionActive, peekOpen, contacts,
  onOpen, onToggle, onFocus, onLeave, onMove, onPeek, onEdit, onTailor,
}: RowProps) {
  const focus = rowFocus(app, next, rw, today);
  const shape = useMemo(() => trailShape(app, next, rw, today), [app, next, rw, today]);

  const checkbox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${app.role} at ${app.company}`}
      tabIndex={-1}
      onClick={(e) => { e.stopPropagation(); onToggle(app._id); }}
      className={`ledger-check shrink-0 -m-1 p-1 rounded-md transition-opacity duration-150 focus:outline-none ${selected || selectionActive ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"}`}
    >
      <CheckboxMark checked={selected} />
    </button>
  );

  const cell = (id: ColumnId): React.ReactNode => {
    switch (id) {
      case "role":
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            {checkbox}
            <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="xs" />
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="text-[13.5px] font-medium text-foreground truncate">{app.role}</span>
              <span className="text-[13px] text-muted-foreground truncate shrink-[2]">{app.company}</span>
            </div>
            <OutreachTag status={app.outreachStatus} />
            {app.aiExtractionStatus === "processing" && <AiPulse size={12} tone="subtle" className="shrink-0" />}
          </div>
        );
      case "focus":
        return (
          <div className="min-w-0 flex flex-col justify-center leading-tight">
            <span className={`text-[13px] font-medium truncate ${TONE_CLASS[focus.tone]}`}>{focus.text}</span>
            {focus.detail && <span className="text-[11.5px] text-muted-foreground truncate mt-px">{focus.detail}</span>}
          </div>
        );
      case "stage":
        return <StageMenu app={app} onMove={onMove} />;
      case "trail":
        return <TrailLine shape={shape} window={TRAIL_WINDOW} className="w-full" />;
      case "fit":
        return <FitCell fit={app.fit} />;
      case "resume":
        return resume ? <span className="text-[13px] text-foreground/80 truncate">{resume.name}</span> : <span className="text-muted-foreground/60">—</span>;
      case "applied":
        return <span className="text-[13px] text-foreground/80 tabular-nums">{app.stage === "Drafting" ? <span className="text-muted-foreground/60">—</span> : shortDate(app.applicationDate)}</span>;
      case "location":
        return app.location?.trim() ? <span className="text-[13px] text-foreground/80 truncate">{app.location}</span> : <span className="text-muted-foreground/60">—</span>;
      case "salary":
        return app.salary?.trim() ? <span className="text-[13px] text-foreground/80 truncate">{app.salary}</span> : <span className="text-muted-foreground/60">—</span>;
      case "source":
        return <span className="text-[13px] text-muted-foreground">{SOURCE_LABEL[app.source ?? "manual"] ?? "Manual"}</span>;
    }
  };

  const rowEvents = {
    "data-row-index": index,
    "aria-selected": selected,
    tabIndex: focused ? 0 : -1,
    onMouseEnter: () => onFocus(index),
    onMouseLeave: () => onLeave(index),
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      // Portaled menus bubble through React; only clicks physically inside
      // the row open it.
      if (!e.currentTarget.contains(e.target as Node)) return;
      onOpen(app, e);
    },
  };
  const tint = peekOpen ? "is-open" : selected ? "bg-primary/[0.06]" : focused ? "bg-control/70" : "";

  return (
    <div style={{ contentVisibility: peekOpen ? "visible" : "auto", containIntrinsicSize: compact ? "auto 76px" : "auto 48px" }}>
      {compact ? (
        <div role="row" {...rowEvents} style={{ scrollMarginTop: ROW_SCROLL_MARGIN }}
          className={`group/row grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 items-center px-3 py-2.5 cursor-pointer transition-colors outline-none ${tint}`}>
          <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="xs" className="row-span-2 self-start mt-0.5" />
          <span className="text-[13.5px] font-medium text-foreground truncate">{app.role}</span>
          <FitCell fit={app.fit} bare />
          <span className="text-[12.5px] text-muted-foreground truncate">{app.company}</span>
          <span />
          <span className="col-start-2 col-span-2 mt-1.5 flex items-center gap-3 min-w-0">
            <span className={`text-[12.5px] font-medium truncate ${TONE_CLASS[focus.tone]}`}>{focus.short}</span>
            <TrailLine shape={shape} window={TRAIL_WINDOW} className="ml-auto w-24 shrink-0" />
          </span>
        </div>
      ) : (
        <div role="row" {...rowEvents} style={{ gridTemplateColumns: template, scrollMarginTop: ROW_SCROLL_MARGIN }}
          className={`ledger-row group/row grid items-center gap-x-4 h-12 pl-3 pr-2 cursor-pointer outline-none ${tint}`}>
          {columns.map((c) => (
            <div key={c.id} role="cell" className={`min-w-0 flex ${c.align === "right" ? "justify-end" : ""}`}>{cell(c.id)}</div>
          ))}
          <div role="cell" className="flex justify-end">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPeek(app._id); }}
              aria-expanded={peekOpen}
              aria-label={peekOpen ? `Close the peek at ${app.role}` : `Peek at ${app.role}`}
              className={`w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control transition-[opacity,background-color,color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 ${
                peekOpen ? "opacity-100 text-foreground" : "opacity-0 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
              }`}
            >
              <ChevronDown size={15} strokeWidth={2} className={`transition-transform duration-200 ease-smooth motion-reduce:transition-none ${peekOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {!compact && (
        <Collapse open={peekOpen}>
          <LedgerPeek
            app={app}
            next={next}
            focus={focus}
            rw={rw}
            contacts={contacts}
            onOpen={() => onOpen(app)}
            onEdit={() => onEdit(app)}
            onTailor={() => onTailor(app._id)}
          />
        </Collapse>
      )}
    </div>
  );
});

/* ─── Group strip ─── */

function GroupStrip({ label, count, summary, collapsed, onToggle, leading, columns, template, compact, focusLabel, uppercase, controls }: {
  label: string;
  count: number;
  summary?: string;
  collapsed?: boolean;
  /** Omitted = a plain header (grouping: none). */
  onToggle?: () => void;
  leading?: React.ReactNode;
  columns: ColumnDef[];
  template: string;
  compact: boolean;
  focusLabel: string;
  uppercase: boolean;
  /** id of the group body, for aria-controls. */
  controls?: string;
}) {
  const title = (
    <>
      {leading}
      <span className={`text-[12px] font-semibold text-foreground whitespace-nowrap ${uppercase ? "shrink-0 uppercase tracking-[0.05em]" : "truncate min-w-[4rem]"}`}>{label}</span>
      <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">{count}</span>
      {summary && <span className="text-[12px] text-muted-foreground truncate min-w-0">· {summary}</span>}
    </>
  );
  return (
    <div
      role="row"
      onClick={onToggle}
      style={{ gridTemplateColumns: compact ? "minmax(0, 1fr)" : template, top: "var(--page-header-h, 0px)", height: STRIP_H }}
      className={`sticky z-10 grid items-center gap-x-4 pl-3 pr-2 bg-sidebar border-y border-border/60 select-none ${onToggle ? "cursor-pointer" : ""}`}
    >
      <div role="rowheader" className="min-w-0 flex items-center">
        {onToggle ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-expanded={!collapsed}
            aria-controls={controls}
            className="-ml-1 pl-1 pr-1.5 h-7 min-w-0 max-w-full inline-flex items-center gap-2 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight size={13} strokeWidth={2.2} className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-smooth motion-reduce:transition-none ${collapsed ? "" : "rotate-90"}`} aria-hidden />
            {title}
          </button>
        ) : (
          <span className="min-w-0 inline-flex items-center gap-2">{title}</span>
        )}
      </div>
      {!compact && columns.slice(1).map((c) => (
        <div key={c.id} role="columnheader" className={`min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/75 ${c.align === "right" ? "text-right" : ""}`}>
          {c.id === "focus" ? focusLabel : c.id === "trail" ? "Last 10 weeks" : c.label}
        </div>
      ))}
      {!compact && <div aria-hidden />}
    </div>
  );
}

/* ─── Skeleton ─── */

function LedgerSkeleton({ template, compact }: { template: string; compact: boolean }) {
  return (
    <div aria-hidden>
      <div className="flex items-center gap-2 px-3 bg-sidebar border-y border-border/60" style={{ height: STRIP_H }}>
        <span className="h-2.5 w-24 rounded bg-muted-foreground/15 animate-pulse" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => compact ? (
        <div key={i} className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-2 px-3 py-3">
          <span className="w-6 h-6 rounded-md bg-muted animate-pulse row-span-2" />
          <span className="h-3 rounded bg-muted animate-pulse" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
          <span className="h-2.5 w-1/3 rounded bg-muted animate-pulse" />
        </div>
      ) : (
        <div key={i} className="grid items-center gap-x-4 h-12 pl-3 pr-2" style={{ gridTemplateColumns: template }}>
          <div className="flex items-center gap-2.5"><span className="w-4" /><span className="w-6 h-6 rounded-md bg-muted animate-pulse" /><span className="h-3 rounded bg-muted animate-pulse" style={{ width: `${40 + ((i * 17) % 35)}%` }} /></div>
          <div className="flex flex-col gap-1.5"><span className="h-3 w-3/4 rounded bg-muted animate-pulse" /><span className="h-2 w-1/2 rounded bg-muted/70 animate-pulse" /></div>
        </div>
      ))}
    </div>
  );
}

/* ─── Ledger ─── */

interface Group { key: string; label: string; summary?: string; stage?: Stage; apps: Application[] }

export default function LedgerList() {
  const shell = useApplicationsShell();
  const { filters, resetFilters } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: resumes = [] } = useResumes();
  const { data: deadlines = [] } = useOpenDeadlines();
  const { data: contacts = [] } = useContacts();
  const rw = useReplyWindow();
  const moveStage = useMoveStage();
  const today = todayYmd();

  /* Width-driven columns. The observer only updates state when a column
   * threshold is crossed — the raw width changes every frame while the
   * sidebar animates, and re-rendering hundreds of rows per frame stutters. */
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const bucket = (w: number) => WIDTH_STEPS.reduce((max, s) => (w >= s ? Math.max(max, s) : max), 0);
    setFitWidth(bucket(el.clientWidth));
    const ro = new ResizeObserver(([entry]) => {
      const next = bucket(entry.contentRect.width);
      setFitWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = fitWidth < COMPACT_BELOW;
  const columns = useMemo(() => ledgerColumns(shell.columnOrder, shell.hiddenColumns, fitWidth), [shell.columnOrder, shell.hiddenColumns, fitWidth]);
  const template = [...columns.map((c) => c.track), PEEK_TRACK].join(" ");

  /* Stage filter is applied here (the shared "all" cache is stage-less). */
  const apps = useMemo(() => (data?.data ?? []).filter((a) => !filters.stage || a.stage === filters.stage), [data, filters.stage]);
  const next = useMemo(() => nextDeadlines(deadlines, today), [deadlines, today]);

  /* Groups + persisted collapse state (Rejected and Closed start folded). */
  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    "hiretrail-apps-ledger-collapsed", ["stage:Rejected", "momentum:closed"],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string"),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const toggleGroup = (key: string) => setCollapsedList(collapsed.has(key) ? collapsedList.filter((k) => k !== key) : [...collapsedList, key]);

  const groups = useMemo<Group[]>(() => {
    const sort = (list: Application[]) => sortApplications(list, shell.ledgerOrder, next, today);
    switch (shell.ledgerGrouping) {
      case "none":
        return [{ key: "all", label: "All applications", apps: sort(apps) }];
      case "stage":
        return PROGRESS_ORDER
          .map((s) => { const list = apps.filter((a) => a.stage === s); return { key: `stage:${s}`, label: s, stage: s, summary: stageSummary(s, list, next, rw, today), apps: sort(list) }; })
          .filter((g) => g.apps.length > 0);
      case "momentum":
        return MOMENTUM_ORDER
          .map((m) => ({ key: `momentum:${m}`, label: MOMENTUM_LABEL[m], summary: momentumSummary(m, rw), apps: sort(apps.filter((a) => momentum(a, next.get(a._id), today) === m)) }))
          .filter((g) => g.apps.length > 0);
      case "company": {
        const byCompany = new Map<string, Application[]>();
        for (const a of apps) byCompany.set(a.company, [...(byCompany.get(a.company) ?? []), a]);
        return [...byCompany.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([company, list]) => ({ key: `company:${company}`, label: company, apps: sort(list) }));
      }
    }
  }, [apps, shell.ledgerGrouping, shell.ledgerOrder, next, rw, today]);

  /* Visible order = what J/K and the application page's next/prev walk. */
  const visible = useMemo(() => groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.apps)), [groups, collapsed]);
  const orderedIds = useMemo(() => visible.map((a) => a._id), [visible]);
  const open = useOpenApplication(orderedIds);
  const resolveCompany = useCompanyResolver(visible);
  const resumeById = useMemo(() => new Map(resumes.map((r) => [r._id, r])), [resumes]);

  const [peekId, setPeekId] = useState<string | null>(null);
  const togglePeek = useCallback((id: string) => setPeekId((cur) => (cur === id ? null : id)), []);
  // A peeked row that left the list (filtered, archived) closes its peek.
  useEffect(() => { if (peekId && !visible.some((a) => a._id === peekId)) setPeekId(null); }, [visible, peekId]);

  const { focusedIndex, setFocusedIndex, leaveRow, selected, toggle, overlays } = useListBehavior({
    apps: visible,
    archived: filters.status === "archived",
    onOpen: (a) => open(a),
    onEdit: shell.openEdit,
    extraShortcuts: compact ? undefined : { " ": (a) => togglePeek(a._id) },
  });
  useRestoreListScroll(!isPending);

  const narrowing = activeFilterCount(filters) > 0 || !!filters.q;
  const grouped = shell.ledgerGrouping !== "none";
  // Running index across groups, assigned in render order (matches `visible`).
  let rowIndex = -1;

  return (
    <div ref={containerRef} className="ledger">
      {isPending ? (
        <LedgerSkeleton template={template} compact={compact} />
      ) : apps.length === 0 ? (
        <EmptyState
          mode={filters.status === "archived" && !narrowing ? "archived" : narrowing || filters.status === "archived" ? "filtered" : "welcome"}
          onAddManually={shell.openCreate}
          onImport={shell.openImport}
          onClearFilters={resetFilters}
        />
      ) : (
        <div role="table" aria-label="Applications" aria-rowcount={visible.length}>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const bodyId = `ledger-group-${g.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
            return (
              <div key={g.key} role="rowgroup" className="mb-3 last:mb-0">
                <GroupStrip
                  label={g.label}
                  count={g.apps.length}
                  summary={g.summary}
                  collapsed={isCollapsed}
                  onToggle={grouped ? () => toggleGroup(g.key) : undefined}
                  controls={bodyId}
                  columns={columns}
                  template={template}
                  compact={compact}
                  focusLabel={g.stage ? FOCUS_LABEL[g.stage] : "Next"}
                  uppercase={shell.ledgerGrouping !== "company"}
                  leading={g.stage
                    ? <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_STRIPE_CLASS[g.stage]}`} aria-hidden />
                    : shell.ledgerGrouping === "company"
                      ? <CompanyLogo name={g.label} logoUrl={resolveCompany(g.apps[0])?.logoUrl} size="2xs" />
                      : undefined}
                />
                <Collapse open={!isCollapsed} id={bodyId}>
                  {!isCollapsed && g.apps.map((a) => {
                    rowIndex += 1;
                    return (
                      <LedgerRow
                        key={a._id}
                        app={a}
                        index={rowIndex}
                        columns={columns}
                        template={template}
                        compact={compact}
                        company={resolveCompany(a)}
                        resume={a.resumeId ? resumeById.get(a.resumeId) : undefined}
                        next={next.get(a._id)}
                        rw={rw}
                        today={today}
                        focused={focusedIndex === rowIndex}
                        selected={selected.has(a._id)}
                        selectionActive={selected.size > 0}
                        peekOpen={peekId === a._id}
                        contacts={peekId === a._id ? contacts : EMPTY}
                        onOpen={open}
                        onToggle={toggle}
                        onFocus={setFocusedIndex}
                        onLeave={leaveRow}
                        onMove={moveStage}
                        onPeek={togglePeek}
                        onEdit={shell.openEdit}
                        onTailor={shell.openTailor}
                      />
                    );
                  })}
                </Collapse>
              </div>
            );
          })}
        </div>
      )}
      {data && data.data.length >= LIST_CAP && (
        <p className="mt-3 text-[12.5px] text-muted-foreground">Showing your {LIST_CAP.toLocaleString()} most recent applications. Narrow the filters to reach older ones.</p>
      )}
      {overlays}
    </div>
  );
}

const EMPTY: Contact[] = [];
