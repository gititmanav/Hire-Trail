/** Trail — the timeline (List view, Personalize → Trail).
 *
 *  Time runs left to right; each application is one line through its stages
 *  (components/TrailLine). Live lines reach today; past the person's own reply
 *  window a line fades (silence, shown honestly — not an alarm); a rejection
 *  ends it with a cross; the next dated step is a diamond ahead of today, red
 *  when it's overdue. Bars over the axis count the applications sent each
 *  week. Grouped by momentum (In motion · Waiting · Drafts · Closed) or stage.
 *
 *  Zoom (1M · 3M · 6M) and paging (‹ Today ›) move one window: --t0 (its
 *  first day) and --span (its length), registered custom properties set on
 *  the view and transitioned (App.css "Trails"). Every line, gridline, label
 *  and bar places itself with calc() from those two numbers, so the whole
 *  timeline glides in one style change — no React render per frame. Labels,
 *  gridlines and bars are drawn for a fixed span of days, so none of them
 *  pops in at the edge while it moves. */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CompanyLogo from "../../../../components/CompanyLogo/CompanyLogo.tsx";
import Collapse from "../../../../components/ui/Collapse.tsx";
import Popover from "../../../../components/ui/Popover.tsx";
import SegmentedControl from "../../../../components/ui/SegmentedControl.tsx";
import Tooltip from "../../../../components/ui/Tooltip.tsx";
import { usePersistentState, oneOf } from "../../../../hooks/usePersistentState.ts";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts.ts";
import { STAGE_STRIPE_CLASS } from "../../../../utils/stageStyles.ts";
import { addDaysYmd, diffDaysYmd, dayOf, formatDay, parseYmd, todayYmd, type Ymd } from "../../../../utils/dates.ts";
import EmptyState from "../../components/EmptyState.tsx";
import TrailLine from "../../components/TrailLine.tsx";
import { OutreachTag } from "../../components/RowBits.tsx";
import { TONE_CLASS } from "../../components/tone.ts";
import { useApplicationsShell } from "../../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams, activeFilterCount } from "../../data/filters.ts";
import { LIST_CAP, useAllApplications, useOpenDeadlines, useReplyWindow } from "../../data/queries.ts";
import {
  MOMENTUM_LABEL, MOMENTUM_ORDER, PROGRESS_ORDER, historySteps, momentum, momentumSummary, nextDeadlines, rowFocus,
  sortApplications, stageSummary, trailShape, type ReplyWindow,
} from "../../data/focus.ts";
import { useCompanyResolver, useListBehavior, useOpenApplication, useRestoreListScroll } from "../shared.tsx";
import type { Application, Company, Deadline, Stage } from "../../../../types";

type Zoom = "1M" | "3M" | "6M";
/** Each zoom: days of past, and the least days of future (more on narrow screens — FUTURE_PX). */
const ZOOM: Record<Zoom, [number, number]> = { "1M": [30, 12], "3M": [84, 21], "6M": [182, 28] };
/** What's drawn (labels, gridlines, bars) — wider than any window, so nothing pops in while it glides. */
const DRAWN: [number, number] = [-400, 120];
/** Room right of today for a next step's label. */
const FUTURE_PX = 196;
const AXIS_H = 64;
const TOOLBAR_H = 44;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/* ─── Axis ─── */

interface Mark { at: number; day: Ymd }

/** Mondays and month starts across the drawn span (days relative to today). */
function axisMarks(today: Ymd) {
  const mondays: Mark[] = [], months: Mark[] = [];
  for (let at = DRAWN[0]; at <= DRAWN[1]; at++) {
    const day = addDaysYmd(today, at);
    const d = parseYmd(day)!;
    if (d.getDay() === 1) mondays.push({ at, day });
    if (d.getDate() === 1) months.push({ at, day });
  }
  return { mondays, months };
}

/** Applications sent per Monday-week (by applied day). */
function weeklySent(apps: Application[], today: Ymd, mondays: Mark[]) {
  const counts = new Map<number, number>();
  for (const a of apps) {
    if (a.stage === "Drafting") continue;
    const first = historySteps(a).find((s) => s.stage !== "Drafting");
    const day = first?.day ?? dayOf(a.applicationDate);
    if (!day) continue;
    const at = diffDaysYmd(today, day);
    const monday = mondays.reduce<number | null>((m, w) => (w.at <= at && (m === null || w.at > m) ? w.at : m), null);
    if (monday !== null) counts.set(monday, (counts.get(monday) ?? 0) + 1);
  }
  return counts;
}

/* ─── Row ─── */

const TrailRow = memo(function TrailRow({ app, index, company, next, rw, today, focused, selected, onOpen, onFocus, onLeave, onHover }: {
  app: Application;
  index: number;
  company?: Company;
  next?: Deadline;
  rw: ReplyWindow;
  today: Ymd;
  focused: boolean;
  selected: boolean;
  onOpen: (app: Application, e?: React.MouseEvent) => void;
  onFocus: (index: number) => void;
  onLeave: (index: number) => void;
  onHover: (app: Application | null, el?: HTMLElement, x?: number) => void;
}) {
  const shape = useMemo(() => trailShape(app, next, rw, today), [app, next, rw, today]);
  const focus = rowFocus(app, next, rw, today);
  return (
    <div
      role="row"
      data-row-index={index}
      tabIndex={focused ? 0 : -1}
      aria-selected={selected}
      onMouseEnter={(e) => { onFocus(index); onHover(app, e.currentTarget, e.clientX); }}
      onMouseLeave={() => { onLeave(index); onHover(null); }}
      onClick={(e) => { if (e.currentTarget.contains(e.target as Node)) onOpen(app, e); }}
      style={{ scrollMarginTop: `calc(var(--page-header-h, 0px) + ${TOOLBAR_H + AXIS_H}px)` }}
      className={`trail-row is-data relative grid items-center cursor-pointer transition-colors outline-none ${selected ? "bg-primary/[0.06]" : focused ? "bg-control/60" : ""}`}
    >
      <div role="cell" className="trail-name min-w-0 flex items-center gap-2 pl-3 pr-3">
        <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="2xs" />
        <span className="min-w-0 truncate text-[13px]">
          <span className="font-medium text-foreground">{app.role}</span>
          <span className="text-muted-foreground"> · {app.company}</span>
        </span>
        <OutreachTag status={app.outreachStatus} />
        {/* Phones: the next step reads at the end of the name line (no room
            for it right of today on the line) — App.css "The Trail view". */}
        <span className={`trail-next shrink-0 ml-auto text-[12px] font-medium whitespace-nowrap ${TONE_CLASS[focus.tone]}`}>{focus.short}</span>
      </div>
      <div role="cell" className="trail-time trail-clip relative h-full min-w-0">
        <TrailLine shape={shape} size="lg" labels />
      </div>
    </div>
  );
});

/* ─── Hover card ─── */

function TrailCard({ app, next, rw, today }: { app: Application; next?: Deadline; rw: ReplyWindow; today: Ymd }) {
  const steps = historySteps(app);
  const focus = rowFocus(app, next, rw, today);
  return (
    <div className="px-3.5 py-3">
      <p className="text-[13px] font-semibold text-foreground leading-snug">{app.role}</p>
      <p className="text-[12px] text-muted-foreground">{[app.company, app.location?.trim()].filter(Boolean).join(" · ")}</p>
      <ol className="mt-2.5 space-y-1">
        {steps.map((s, i) => {
          const end = i + 1 < steps.length ? steps[i + 1].day : today;
          const days = Math.max(0, diffDaysYmd(s.day, end));
          return (
            <li key={`${s.stage}-${s.day}-${i}`} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
              <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[s.stage as Stage]}`} aria-hidden />
              <span className="text-foreground truncate">{s.stage} · {formatDay(s.day, { month: "short", day: "numeric" })}</span>
              <span className="text-muted-foreground tabular-nums">{s.stage === "Rejected" ? "closed" : `${days}d${i === steps.length - 1 ? " so far" : ""}`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 pt-2.5 border-t border-border text-[12px] truncate">
        <span className={`font-medium ${TONE_CLASS[focus.tone]}`}>{focus.text}</span>
        {focus.detail && <span className="text-muted-foreground"> · {focus.detail}</span>}
      </p>
    </div>
  );
}

/* ─── View ─── */

interface Group { key: string; label: string; summary?: string; stage?: Stage; apps: Application[] }

export default function TrailView() {
  const shell = useApplicationsShell();
  const { filters, resetFilters } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: deadlines = [] } = useOpenDeadlines();
  const rw = useReplyWindow();
  const today = todayYmd();
  const next = useMemo(() => nextDeadlines(deadlines, today), [deadlines, today]);
  const apps = useMemo(() => (data?.data ?? []).filter((a) => !filters.stage || a.stage === filters.stage), [data, filters.stage]);

  /* The window: zoom (remembered) + paging (this visit). */
  const [zoom, setZoom] = usePersistentState<Zoom>("hiretrail-apps-trail-zoom", "3M", oneOf(["1M", "3M", "6M"] as const));
  const [shift, setShift] = useState(0);

  /* The timeline's width — how much room the future gets, and which axis labels fit. */
  const axisRef = useRef<HTMLDivElement>(null);
  const [axisWidth, setAxisWidth] = useState(800);
  useLayoutEffect(() => {
    const el = axisRef.current;
    if (!el) return;
    const measure = (w: number) => setAxisWidth((prev) => (Math.abs(prev - w) < 40 ? prev : Math.round(w)));
    measure(el.clientWidth);
    const ro = new ResizeObserver(([e]) => measure(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The future keeps room for a label ("Thank-you overdue · 14d") right of
  // today: FUTURE_PX of it, or a third of a narrow timeline.
  const past = ZOOM[zoom][0];
  const futurePx = Math.min(FUTURE_PX, Math.round(axisWidth / 3));
  const future = Math.max(ZOOM[zoom][1], Math.ceil((futurePx * past) / (axisWidth - futurePx)));
  const span = past + future;
  const t0 = -past + shift;
  const page = (dir: 1 | -1) => setShift((s) => Math.min(future * 2, s + dir * Math.round(span / 2)));
  const rangeEnd = addDaysYmd(today, t0 + span);
  const range = `${formatDay(addDaysYmd(today, t0), { month: "short", day: "numeric" })} – ${formatDay(rangeEnd, { month: "short", day: "numeric" })}`;
  const pxPerDay = axisWidth / span;

  const { mondays, months } = useMemo(() => axisMarks(today), [today]);
  const sent = useMemo(() => weeklySent(data?.data ?? [], today, mondays), [data, today, mondays]);
  const sentMax = Math.max(1, ...sent.values());

  /* Groups + persisted collapse state. */
  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    "hiretrail-apps-trail-collapsed", ["momentum:closed", "stage:Rejected"],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string"),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const toggleGroup = (key: string) => setCollapsedList(collapsed.has(key) ? collapsedList.filter((k) => k !== key) : [...collapsedList, key]);

  const groups = useMemo<Group[]>(() => {
    const sort = (list: Application[]) => sortApplications(list, "smart", next, today);
    if (shell.trailGrouping === "stage") {
      return PROGRESS_ORDER
        .map((s) => { const list = apps.filter((a) => a.stage === s); return { key: `stage:${s}`, label: s, stage: s, summary: stageSummary(s, list, next, rw, today), apps: sort(list) }; })
        .filter((g) => g.apps.length > 0);
    }
    return MOMENTUM_ORDER
      .map((m) => ({ key: `momentum:${m}`, label: MOMENTUM_LABEL[m], summary: momentumSummary(m, rw), apps: sort(apps.filter((a) => momentum(a, next.get(a._id), today) === m)) }))
      .filter((g) => g.apps.length > 0);
  }, [apps, shell.trailGrouping, next, rw, today]);

  const visible = useMemo(() => groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.apps)), [groups, collapsed]);
  const orderedIds = useMemo(() => visible.map((a) => a._id), [visible]);
  const open = useOpenApplication(orderedIds);
  const resolveCompany = useCompanyResolver(visible);
  const { focusedIndex, setFocusedIndex, leaveRow, selected, overlays } = useListBehavior({
    apps: visible, archived: filters.status === "archived", onOpen: (a) => open(a), onEdit: shell.openEdit,
  });
  useRestoreListScroll(!isPending);

  /* One hover card for the whole view, anchored where the pointer entered a row. */
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<Application | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const onHover = useCallback((app: Application | null, el?: HTMLElement, x?: number) => {
    window.clearTimeout(hoverTimer.current);
    if (!app || !el || x == null) { setHovered(null); return; }
    hoverTimer.current = window.setTimeout(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = el.getBoundingClientRect();
      anchor.style.left = `${Math.min(Math.max(x, r.left + 24), r.right - 24)}px`;
      anchor.style.top = `${r.top}px`;
      anchor.style.height = `${r.height}px`;
      setHovered(app);
    }, 320);
  }, []);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  // A scroll moves the rows out from under the card — close it.
  useEffect(() => {
    if (!hovered) return;
    const close = () => setHovered(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [hovered]);

  usePageShortcuts({ t: () => setShift(0), "[": () => page(-1), "]": () => page(1) });

  const narrowing = activeFilterCount(filters) > 0 || !!filters.q;
  if (!isPending && apps.length === 0) {
    return (
      <EmptyState
        mode={filters.status === "archived" && !narrowing ? "archived" : narrowing || filters.status === "archived" ? "filtered" : "welcome"}
        onAddManually={shell.openCreate}
        onImport={shell.openImport}
        onClearFilters={resetFilters}
      />
    );
  }

  // Where a day sits on the timeline at this zoom (px). A label that would run
  // into the "Today" pill, or be cut by either edge, fades out instead.
  const xOf = (at: number) => (at - t0) * pxPerDay;
  const monthShown = (at: number) => (at * pxPerDay >= 18 || at * pxPerDay <= -58) && xOf(at) >= 0 && xOf(at) + 40 <= axisWidth;
  const weekdayShown = (at: number) => zoom !== "6M" && Math.abs(at) * pxPerDay >= 24 && xOf(at) >= 8 && xOf(at) + 8 <= axisWidth;
  let rowIndex = -1;

  return (
    <div className="trail-view trail-zoom" style={{ "--t0": t0, "--span": span } as Vars}>
      {/* Toolbar: the window, its paging, its zoom. */}
      <div className="sticky z-20 -mx-4 md:-mx-6 px-4 md:px-6 -mt-5 flex items-center gap-2 bg-background border-b border-border" style={{ top: "var(--page-header-h, 0px)", height: TOOLBAR_H }}>
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground tabular-nums mr-1 whitespace-nowrap">
          {range}<span className="hidden sm:inline">, {rangeEnd.slice(0, 4)}</span>
        </span>
        <div className="shrink-0 flex items-center gap-0.5">
        <Tooltip label="Earlier" shortcut="[">
          <button type="button" onClick={() => page(-1)} aria-label="Earlier" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft size={15} strokeWidth={2} aria-hidden />
          </button>
        </Tooltip>
        <Tooltip label="Back to today" shortcut="T">
          <button type="button" onClick={() => setShift(0)} disabled={shift === 0} className="h-7 px-2.5 rounded-md border border-border text-[12.5px] font-medium text-foreground hover:bg-control disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Today
          </button>
        </Tooltip>
        <Tooltip label="Later" shortcut="]">
          <button type="button" onClick={() => page(1)} disabled={shift >= future * 2} aria-label="Later" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control disabled:opacity-40 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight size={15} strokeWidth={2} aria-hidden />
          </button>
        </Tooltip>
        </div>
        <div className="ml-auto shrink-0">
          <SegmentedControl<Zoom> ariaLabel="Zoom" size="sm" value={zoom} onChange={(z) => { setZoom(z); setShift(0); }}
            segments={[{ value: "1M", label: "1M" }, { value: "3M", label: "3M" }, { value: "6M", label: "6M" }]} />
        </div>
      </div>

      {/* Axis: sent-per-week bars, months, Mondays, today. Sticks under the toolbar. */}
      <div className="trail-axis sticky z-10 bg-background border-b border-border" style={{ top: `calc(var(--page-header-h, 0px) + ${TOOLBAR_H}px)`, height: AXIS_H }}>
        <div className="trail-row grid h-full">
          <div className="trail-axis-labels relative text-[11px] text-muted-foreground">
            <span className="absolute left-3 top-[13px]">Sent per week</span>
            <span className="absolute left-3 bottom-[12px] uppercase tracking-[0.06em] text-muted-foreground/80">Application</span>
          </div>
          <div ref={axisRef} className="trail-clip relative h-full min-w-0">
            {mondays.map((w) => {
              const n = sent.get(w.at);
              if (!n) return null;
              const h = 4 + (n / sentMax) * 12;
              return (
                <span key={`bar-${w.at}`} className="trail-week-bar" style={{ "--a": w.at, "--b": w.at + 7, height: h } as Vars}>
                  <span className={`trail-week-count ${xOf(w.at) >= 0 && xOf(w.at + 7) <= axisWidth ? "" : "is-hidden"}`}>{n}</span>
                </span>
              );
            })}
            {months.map((m) => (
              <span key={`m-${m.at}`} className={`trail-month ${monthShown(m.at) ? "" : "is-hidden"}`} style={{ "--at": m.at } as Vars}>
                {formatDay(m.day, m.day.slice(5, 7) === "01" ? { month: "short", year: "numeric" } : { month: "short" })}
              </span>
            ))}
            {mondays.map((w) => (
              <span key={`w-${w.at}`} className={`trail-weekday ${weekdayShown(w.at) ? "" : "is-hidden"}`} style={{ "--at": w.at } as Vars}>
                {w.day.slice(8).replace(/^0/, "")}
              </span>
            ))}
            <span className="trail-today-pill" style={{ "--at": 0 } as Vars}>Today</span>
          </div>
        </div>
      </div>

      {isPending ? (
        <TrailSkeleton />
      ) : (
        <div className="relative pb-2" role="table" aria-label="Applications over time" aria-rowcount={visible.length}>
          {/* Gridlines, today, the future — under the rows. */}
          <div className="trail-grid-overlay" aria-hidden>
            {mondays.map((w) => <span key={w.at} className="trail-gridline" style={{ "--at": w.at } as Vars} />)}
            <span className="trail-future" style={{ "--a": 0, "--b": DRAWN[1] } as Vars} />
            <span className="trail-today-line" style={{ "--at": 0 } as Vars} />
          </div>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key} role="rowgroup" className="relative">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  aria-expanded={!isCollapsed}
                  className="relative z-[1] w-full h-9 flex items-center gap-2 pl-3 pr-3 bg-sidebar border-y border-border/60 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <ChevronRight size={13} strokeWidth={2.2} className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-smooth motion-reduce:transition-none ${isCollapsed ? "" : "rotate-90"}`} aria-hidden />
                  {g.stage && <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_STRIPE_CLASS[g.stage]}`} aria-hidden />}
                  <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.05em] text-foreground">{g.label}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{g.apps.length}</span>
                  {g.summary && <span className="text-[12px] text-muted-foreground truncate min-w-0">· {g.summary}</span>}
                </button>
                <Collapse open={!isCollapsed}>
                  {!isCollapsed && g.apps.map((a) => {
                    rowIndex += 1;
                    return (
                      <TrailRow
                        key={a._id}
                        app={a}
                        index={rowIndex}
                        company={resolveCompany(a)}
                        next={next.get(a._id)}
                        rw={rw}
                        today={today}
                        focused={focusedIndex === rowIndex}
                        selected={selected.has(a._id)}
                        onOpen={open}
                        onFocus={setFocusedIndex}
                        onLeave={leaveRow}
                        onHover={onHover}
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

      <span ref={anchorRef} aria-hidden className="fixed w-px pointer-events-none" />
      <Popover
        open={!!hovered}
        onOpenChange={(o) => { if (!o) setHovered(null); }}
        anchorRef={anchorRef}
        width={272}
        role="tooltip"
        autoFocus={false}
        style={{ pointerEvents: "none" }}
      >
        {hovered && <TrailCard app={hovered} next={next.get(hovered._id)} rw={rw} today={today} />}
      </Popover>
      {overlays}
    </div>
  );
}

function TrailSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-9 bg-sidebar border-y border-border/60 flex items-center px-3"><span className="h-2.5 w-24 rounded bg-muted-foreground/15 animate-pulse" /></div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="trail-row is-data grid items-center">
          <div className="trail-name flex items-center gap-2 pl-3"><span className="w-5 h-5 rounded-md bg-muted animate-pulse" /><span className="h-3 rounded bg-muted animate-pulse" style={{ width: `${45 + ((i * 17) % 35)}%` }} /></div>
          <div className="trail-time relative h-full"><span className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-muted animate-pulse" style={{ left: `${40 + ((i * 23) % 40)}%`, right: "16%" }} /></div>
        </div>
      ))}
    </div>
  );
}
