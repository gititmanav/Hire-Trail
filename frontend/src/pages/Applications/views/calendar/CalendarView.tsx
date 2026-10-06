/**
 * Calendar — the planning surface of Applications (List · Board · Calendar).
 *
 * Built for a job seeker's question, "what's due, what's overdue, what do I do
 * today?": deadlines (actions) read first; applied dates and stage entries
 * (records) recede behind a stage-coloured dot. Three scales, all date-only
 * (no time grids): Month · Week · Day.
 *
 * Data: GET /api/calendar for the visible range under the page's URL filters
 * (views/calendar/data.ts); neighbours are prefetched so paging paints from
 * cache. Layout: utils/calendarGrid.ts (pure, tested). Dates: utils/dates.ts
 * only. The anchor lives in the URL (`?d=`), so Back from an application lands
 * on the same page of the calendar; the scale is a remembered preference.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SegmentedControl from "../../../../components/ui/SegmentedControl.tsx";
import Tooltip from "../../../../components/ui/Tooltip.tsx";
import ConfirmModal from "../../../../components/ConfirmModal/ConfirmModal.tsx";
import DeadlineFormModal from "../../../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { useConfirm } from "../../../../hooks/useConfirm.ts";
import { useMediaQuery } from "../../../../hooks/useMediaQuery.ts";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts.ts";
import { usePersistentState, oneOf } from "../../../../hooks/usePersistentState.ts";
import {
  anchorFor, carryAnchor, cellAtPoint, groupByDay, monthWeeks, projectGhosts, shiftAnchor, visibleRange, weekDays,
  type CalendarEvent, type Scale,
} from "../../../../utils/calendarGrid.ts";
import { isYmd, monthOf, todayYmd, weekStartDay, type Ymd } from "../../../../utils/dates.ts";
import type { ApplicationsShell } from "../../ApplicationsLayout.tsx";
import { useApplicationFilters, parseFilters, toListParams } from "../../data/filters.ts";
import { useAllApplications } from "../../data/queries.ts";
import { useOpenApplication } from "../shared.tsx";
import type { Deadline } from "../../../../types";
import {
  calendarParams, DEFAULT_SHOW, useCalendarRange, useCompleteDeadline, useDeleteDeadline, useMoveEvent, usePrefetchRanges, useSaveDeadline,
} from "./data.ts";
import { CalendarOpenContext, type ChipHandlers } from "./parts.tsx";
import { useCalendarDrag } from "./useCalendarDrag.ts";
import MonthView, { type DayActions } from "./MonthView.tsx";
import WeekView from "./WeekView.tsx";
import DayView from "./DayView.tsx";
import DayPeek from "./DayPeek.tsx";
import DeadlinePopover, { type DeadlineActions } from "./DeadlinePopover.tsx";
import TitlePicker from "./TitlePicker.tsx";

const SCALES: { value: Scale; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Today, kept current across midnight and a tab left open for days. */
function useToday(): Ymd {
  const [today, setToday] = useState(todayYmd);
  useEffect(() => {
    const sync = () => setToday(todayYmd());
    const now = new Date();
    const toMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 500;
    const t = window.setTimeout(sync, toMidnight);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearTimeout(t); document.removeEventListener("visibilitychange", sync); };
  }, [today]);
  return today;
}

type Dialog = { mode: "new"; date: Ymd } | { mode: "edit"; deadline: Deadline };

export default function CalendarView() {
  const shell = useOutletContext<ApplicationsShell | undefined>();
  const navigate = useNavigate();
  const { filters } = useApplicationFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const compact = useMediaQuery("(max-width: 639px)");
  const weekStart = useMemo(() => weekStartDay(), []);
  const today = useToday();
  const show = shell?.calendarShow ?? DEFAULT_SHOW;

  /* ─── Scale + anchor ─── */
  const [savedScale, setSavedScale] = usePersistentState<Scale>(
    "hiretrail-cal-scale",
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? "day" : "month",
    oneOf(["month", "week", "day"] as const),
  );
  // Seven columns don't fit a phone: its week is the Day view's week strip.
  const scale: Scale = compact && savedScale === "week" ? "day" : savedScale;
  const rawAnchor = searchParams.get("d");
  const anchor = anchorFor(scale, isYmd(rawAnchor) ? rawAnchor : today, weekStart);
  const [navDir, setNavDir] = useState<"next" | "prev" | null>(null);
  const [focusedDay, setFocusedDay] = useState<Ymd>(today);
  // The latest anchor, ahead of the URL round-trip — a held arrow key pages
  // faster than the router re-renders, and each press must build on the last.
  const latestAnchor = useRef(anchor);
  latestAnchor.current = anchor;

  const setAnchor = useCallback((day: Ymd, dir: "next" | "prev" | null) => {
    latestAnchor.current = anchorFor(scale, day, weekStart);
    setNavDir(dir);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      // Today's page needs no parameter — a clean URL is "now".
      if (anchorFor(scale, day, weekStart) === anchorFor(scale, today, weekStart)) next.delete("d"); else next.set("d", day);
      return next;
    }, { replace: true });
  }, [setSearchParams, scale, weekStart, today]);

  const page = useCallback((delta: 1 | -1) => {
    const next = shiftAnchor(scale, latestAnchor.current, delta);
    setAnchor(next, delta > 0 ? "next" : "prev");
    setFocusedDay(scale === "month" && today.slice(0, 7) === next.slice(0, 7) ? today : next);
  }, [scale, setAnchor, today]);

  const goTo = useCallback((day: Ymd) => {
    const target = anchorFor(scale, day, weekStart);
    if (target !== anchor) setAnchor(day, target > anchor ? "next" : "prev");
    setFocusedDay(day);
  }, [scale, weekStart, anchor, setAnchor]);

  const changeScale = useCallback((to: Scale) => {
    if (to === scale) return;
    const carried = carryAnchor(scale, to, anchor, today, weekStart);
    setNavDir(null);
    setSavedScale(to);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (anchorFor(to, carried, weekStart) === anchorFor(to, today, weekStart)) next.delete("d"); else next.set("d", carried);
      return next;
    }, { replace: true });
  }, [scale, anchor, today, weekStart, setSavedScale, setSearchParams]);

  /* ─── Data ─── */
  // The Day view loads its whole week (the phone's week strip, instant day paging).
  const range = visibleRange(scale === "day" ? "week" : scale, anchor, weekStart);
  const params = calendarParams(filters, range.from, range.to);
  const query = useCalendarRange(params);
  const prevRange = visibleRange(scale === "day" ? "week" : scale, shiftAnchor(scale === "day" ? "week" : scale, anchor, -1), weekStart);
  const nextRange = visibleRange(scale === "day" ? "week" : scale, shiftAnchor(scale === "day" ? "week" : scale, anchor, 1), weekStart);
  usePrefetchRanges([calendarParams(filters, prevRange.from, prevRange.to), calendarParams(filters, nextRange.from, nextRange.to)]);

  const events = useMemo(() => query.data?.events ?? [], [query.data]);
  const apps = useMemo(() => query.data?.applications ?? {}, [query.data]);
  const ghosts = useMemo(
    () => (show.deadline ? projectGhosts(events.filter((e) => (e.recurrenceDays ?? 0) > 0), range.from, range.to, today) : []),
    [events, range.from, range.to, today, show.deadline],
  );

  /* ─── Navigation into applications ─── */
  const recordIds = useMemo(() => [...new Set(events.filter((e) => e.kind !== "deadline" && e.applicationId).map((e) => e.applicationId!))], [events]);
  const openApplication = useOpenApplication(recordIds);
  const openApp = useCallback((id: string) => openApplication({ _id: id }), [openApplication]);
  const openPath = useCallback((path: string) => {
    const m = /^\/applications\/([^/?#]+)$/.exec(path);
    if (m) openApp(m[1]); else navigate(path);
  }, [openApp, navigate]);

  /* ─── Mutations ─── */
  const move = useMoveEvent();
  const complete = useCompleteDeadline();
  const del = useDeleteDeadline();
  const saveDeadline = useSaveDeadline();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  /* ─── Drag ─── */
  const gridEl = useRef<HTMLDivElement | null>(null);
  const setGridEl = useCallback((el: HTMLDivElement | null) => { gridEl.current = el; }, []);
  const dayAtPoint = useCallback((x: number, y: number): Ymd | null => {
    const el = gridEl.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (scale === "month") {
      const cell = cellAtPoint(r, x, y, 6, 7);
      const { year, month } = monthOf(anchor);
      return cell ? monthWeeks(year, month, weekStart)[cell.row][cell.col] : null;
    }
    if (scale === "week") {
      const cell = cellAtPoint(r, x, y, 1, 7);
      return cell ? weekDays(anchor)[cell.col] : null;
    }
    return null;
  }, [scale, anchor, weekStart]);
  const { drag, onPointerDown, swallowClick } = useCalendarDrag({
    today,
    dayAtPoint,
    onDrop: (event, day, origin) => move.mutate({ event, to: day, from: origin }),
  });

  /* ─── What's on screen ─── */
  const visible = useMemo(() => {
    const all = [...events, ...ghosts].filter((e) => show[e.kind] && e.date >= range.from && e.date <= range.to);
    // The drag preview is the truth: the dragged chip sits on the day it would land.
    if (drag?.day && drag.allowed) return all.map((e) => (e.id === drag.event.id ? { ...e, date: drag.day! } : e));
    return all;
  }, [events, ghosts, show, range.from, range.to, drag]);
  const byDay = useMemo(() => groupByDay(visible, today), [visible, today]);
  // The Day view's pinned Overdue group reads every open overdue deadline.
  const dayEvents = useMemo(() => [...events, ...ghosts].filter((e) => show[e.kind]), [events, ghosts, show]);

  /* ─── Popovers + dialogs ─── */
  const [peek, setPeek] = useState<{ day: Ymd; cell: HTMLElement } | null>(null);
  const [deadlinePop, setDeadlinePop] = useState<{ event: CalendarEvent; anchor: HTMLElement } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { data: appOptions } = useAllApplications(toListParams(parseFilters(new URLSearchParams())), { enabled: !!dialog });

  // Leaving the page (or the data under an open peek changing its day) closes floating panels.
  useEffect(() => { setPeek(null); setDeadlinePop(null); }, [anchor, scale]);

  const openAdd = useCallback((day: Ymd) => { setPeek(null); setDialog({ mode: "new", date: day }); }, []);

  const chips: ChipHandlers = useMemo(() => ({
    onClick: (e, el) => {
      if (swallowClick()) return;
      if (e.kind === "deadline") {
        const real = e.ghost ? events.find((x) => x.id === e.realId) : e;
        if (real) setDeadlinePop({ event: real, anchor: el });
      } else if (e.applicationId) {
        openApp(e.applicationId);
      }
    },
    onPointerDown,
  }), [events, openApp, onPointerDown, swallowClick]);

  const dayActions: DayActions = useMemo(() => ({
    onAdd: openAdd,
    onPeek: (day, cell) => setPeek({ day, cell }),
    onOpenDay: (day) => { setSavedScale("day"); setNavDir(null); setSearchParams((prev) => { const n = new URLSearchParams(prev); if (day === today) n.delete("d"); else n.set("d", day); return n; }, { replace: true }); },
  }), [openAdd, setSavedScale, setSearchParams, today]);

  const deadlineActions: DeadlineActions = useMemo(() => ({
    complete: (e) => complete.mutate(e),
    reschedule: (e, day) => move.mutate({ event: e, to: day, from: e.date }),
    edit: (e) => setDialog({
      mode: "edit",
      deadline: {
        _id: e.entityId, userId: "", applicationId: e.applicationId, type: e.title, dueDate: e.date,
        completed: false, notes: e.notes ?? "", recurrenceDays: e.recurrenceDays ?? 0, createdAt: "", updatedAt: "",
      },
    }),
    remove: async (e) => {
      const ok = await confirm(`"${e.title}"${e.company ? ` for ${e.company}` : ""} will be deleted.`, { title: "Delete this deadline?", confirmLabel: "Delete" });
      if (ok) del.mutate(e);
    },
    openApplication: openApp,
  }), [complete, move, confirm, del, openApp]);

  /* ─── Create (the shell's button and "c") ─── */
  useEffect(() => {
    if (!shell) return;
    shell.registerCalendarCreate(() => openAdd(focusedDay >= range.from && focusedDay <= range.to ? focusedDay : today));
    return () => shell.registerCalendarCreate(null);
  }, [shell, openAdd, focusedDay, range.from, range.to, today]);

  /* ─── Keyboard ─── */
  usePageShortcuts({
    ArrowLeft: () => page(-1),
    ArrowRight: () => page(1),
    t: () => goTo(today),
    m: () => changeScale("month"),
    w: () => { if (compact) return false; changeScale("week"); },
    d: () => changeScale("day"),
  });

  const animClass = navDir ? `cal-in-${navDir}` : "";
  const segments = compact ? SCALES.filter((s) => s.value !== "week") : SCALES;

  return (
    <CalendarOpenContext.Provider value={openPath}>
      <div className="flex-1 min-h-0 flex flex-col select-none">
        {/* Header: title (the mini calendar) · scale · ‹ Today › */}
        <div className="flex items-center justify-between gap-3 pb-2.5 flex-wrap">
          <TitlePicker scale={scale} anchor={anchor} weekStart={weekStart} today={today} filters={filters} onPick={goTo} />
          <div className="flex items-center gap-2">
            <SegmentedControl<Scale> ariaLabel="Calendar scale" size="sm" value={scale} onChange={changeScale} segments={segments.map((s) => ({ value: s.value, label: s.label }))} />
            <div className="flex items-center gap-0.5">
              <Tooltip label={`Previous ${scale}`} shortcut="←">
                <button type="button" onClick={() => page(-1)} aria-label={`Previous ${scale}`} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
              <Tooltip label="Jump to today" shortcut="T">
                <button type="button" onClick={() => goTo(today)} className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                  Today
                </button>
              </Tooltip>
              <Tooltip label={`Next ${scale}`} shortcut="→">
                <button type="button" onClick={() => page(1)} aria-label={`Next ${scale}`} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {query.isError && !query.data ? (
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <p className="text-[14px] font-medium text-foreground">Couldn't load your calendar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Check your connection and try again.</p>
              <button type="button" onClick={() => void query.refetch()} className="mt-4 h-8 px-3 rounded-lg border border-border text-[13px] font-medium hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Try again
              </button>
            </div>
          </div>
        ) : !query.data ? (
          <CalendarSkeleton scale={scale} compact={compact} />
        ) : scale === "month" ? (
          <MonthView
            anchor={anchor}
            weekStart={weekStart}
            today={today}
            byDay={byDay}
            apps={apps}
            animClass={animClass}
            compact={compact}
            drag={drag}
            chips={chips}
            actions={dayActions}
            gridRef={setGridEl}
            focusedDay={focusedDay}
            onFocusDay={setFocusedDay}
            onNavigateTo={(day) => setAnchor(day, day > anchor ? "next" : "prev")}
          />
        ) : scale === "week" ? (
          <WeekView start={anchor} today={today} byDay={byDay} apps={apps} animClass={animClass} drag={drag} chips={chips} actions={dayActions} gridRef={setGridEl} />
        ) : (
          <DayView
            day={anchor}
            today={today}
            weekStart={weekStart}
            events={dayEvents}
            apps={apps}
            animClass={animClass}
            compact={compact}
            onSelectDay={goTo}
            onAdd={openAdd}
            onOpenDeadline={(e, el) => {
              const real = e.ghost ? events.find((x) => x.id === e.realId) : e;
              if (real) setDeadlinePop({ event: real, anchor: el });
            }}
            onOpenApplication={openApp}
            actions={deadlineActions}
          />
        )}
      </div>

      <DayPeek
        peek={peek}
        list={peek ? byDay.get(peek.day) ?? [] : []}
        apps={apps}
        today={today}
        chips={chips}
        onAdd={openAdd}
        onClose={() => setPeek(null)}
      />
      <DeadlinePopover
        event={deadlinePop?.event ?? null}
        anchor={deadlinePop?.anchor ?? null}
        today={today}
        onClose={() => setDeadlinePop(null)}
        actions={deadlineActions}
      />
      {dialog && (
        <DeadlineFormModal
          deadline={dialog.mode === "edit" ? dialog.deadline : null}
          initialDueDate={dialog.mode === "new" ? dialog.date : undefined}
          applications={appOptions?.data ?? []}
          onClose={() => setDialog(null)}
          onSave={async (data) => {
            await saveDeadline(dialog.mode === "edit" ? dialog.deadline._id : null, data);
            setDialog(null);
          }}
        />
      )}
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </CalendarOpenContext.Provider>
  );
}

/** A calendar-shaped placeholder for the very first load (paging never shows it). */
function CalendarSkeleton({ scale, compact }: { scale: Scale; compact: boolean }) {
  if (scale === "day") {
    return (
      <div className="flex-1 min-h-0 max-w-[760px] space-y-2 pt-2" aria-label="Loading calendar">
        {[60, 80, 45, 70, 55].map((w, i) => (
          <div key={i} className="flex items-center gap-3 h-11 px-2">
            <span className="w-4 h-4 rounded bg-control animate-pulse" />
            <span className="h-3 rounded bg-control animate-pulse" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  const rows = scale === "month" ? 6 : 1;
  return (
    <div className="flex-1 min-h-0 flex flex-col" aria-label="Loading calendar">
      <div className="grid grid-cols-7 border-b border-border/70 pb-1.5">
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="mx-2 h-2.5 w-8 rounded bg-control animate-pulse" />)}
      </div>
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="grid grid-cols-7 border-b border-border/70 last:border-b-0">
            {Array.from({ length: 7 }, (_, c) => (
              <div key={c} className="border-r border-border/70 last:border-r-0 p-2 space-y-1.5">
                <span className="block h-2.5 w-4 rounded bg-control animate-pulse" />
                {!compact && (r + c) % 3 === 0 && <span className="block h-2.5 w-3/4 rounded bg-control/70 animate-pulse" />}
                {!compact && (r * 7 + c) % 5 === 1 && <span className="block h-2.5 w-1/2 rounded bg-control/70 animate-pulse" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
