/** Month scale: 6 × 7 days, each an ordered list of chips.
 *
 *  - Measured overflow: a ResizeObserver on the (keyed) grid gives the row
 *    height, so we know how many chips fit; an overflowing day gives its last
 *    slot to "N more", which opens the day peek. The observer re-attaches on
 *    every remount (a callback ref), so paging never leaves it watching a
 *    grid that's gone.
 *  - Roving focus: the grid is one tab stop; arrows move the day, PageUp/Down
 *    page months, Enter opens the day (peek, or quick-add on an empty day).
 *  - Compact (phones): dots instead of chips; a tap opens the Day view. */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import MonthGrid, { DayNumber, WeekdayHeader, type DayInfo } from "../../../../components/ui/MonthGrid.tsx";
import { DATE_STRIP, describeDay, slotsFor, splitOverflow, type CalendarEvent } from "../../../../utils/calendarGrid.ts";
import { addDaysYmd, formatDay, monthOf, shiftMonth, weekStartOf, ymdOf, type Ymd } from "../../../../utils/dates.ts";
import { STAGE_COLOR } from "../../../../utils/stageStyles.ts";
import type { CalendarApp } from "../../../../utils/api.ts";
import { EventChip, isOverdue, type ChipHandlers } from "./parts.tsx";
import type { DragState } from "./useCalendarDrag.ts";

export interface DayActions {
  onAdd: (day: Ymd) => void;
  onPeek: (day: Ymd, cell: HTMLElement) => void;
  /** Open the Day view on this day. */
  onOpenDay: (day: Ymd) => void;
}

export default function MonthView({
  anchor, weekStart, today, byDay, apps, animClass, compact, drag, chips, actions, gridRef, focusedDay, onFocusDay, onNavigateTo,
}: {
  anchor: Ymd;
  weekStart: number;
  today: Ymd;
  byDay: Map<Ymd, CalendarEvent[]>;
  apps: Record<string, CalendarApp>;
  animClass: string;
  compact: boolean;
  drag: DragState | null;
  chips: ChipHandlers;
  actions: DayActions;
  gridRef: (el: HTMLDivElement | null) => void;
  focusedDay: Ymd;
  onFocusDay: (day: Ymd) => void;
  /** Keyboard moved focus outside this month: show that day's month. */
  onNavigateTo: (day: Ymd) => void;
}) {
  const { year, month } = monthOf(anchor);
  const [slots, setSlots] = useState(4);
  const wantFocus = useRef(false);
  const gridEl = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const attach = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    gridEl.current = el;
    gridRef(el);
    if (!el) return;
    const measure = () => setSlots(slotsFor(el.clientHeight / 6));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, [gridRef]);
  useEffect(() => () => observer.current?.disconnect(), []);

  // Keyboard navigation moves real focus to the new day (also after a page turn remounts the grid).
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridEl.current?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus({ preventScroll: true });
  }, [focusedDay, anchor]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).matches("[data-day]")) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Ymd | null = null;
    if (e.key in step) next = addDaysYmd(focusedDay, step[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const to = shiftMonth(year, month, e.key === "PageDown" ? 1 : -1);
      // Same day of the month, clamped (Jan 31 → Feb 28/29).
      const last = Number(ymdOf(to.year, to.month + 1, 0).slice(8, 10));
      next = ymdOf(to.year, to.month, Math.min(Number(focusedDay.slice(8, 10)), last));
    } else if (e.key === "Home" || e.key === "End") {
      const start = weekStartOf(focusedDay, weekStart);
      next = e.key === "Home" ? start : addDaysYmd(start, 6);
    }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const cell = gridEl.current?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`);
      if (compact) actions.onOpenDay(focusedDay);
      else if ((byDay.get(focusedDay)?.length ?? 0) > 0 && cell) actions.onPeek(focusedDay, cell);
      else actions.onAdd(focusedDay);
      return;
    }
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    wantFocus.current = true;
    onFocusDay(next);
    const m = monthOf(next);
    if (m.year !== year || m.month !== month) onNavigateTo(next);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <WeekdayHeader
        weekStart={weekStart}
        width={compact ? "narrow" : "short"}
        className="border-b border-border/70"
        cellClassName={`pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground ${compact ? "text-center" : "pl-2"}`}
      />
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <MonthGrid
          key={anchor}
          ref={attach}
          year={year}
          month={month}
          weekStart={weekStart}
          today={today}
          role="grid"
          ariaLabel={formatDay(anchor, { month: "long", year: "numeric" })}
          onKeyDown={onKeyDown}
          className={`absolute inset-0 ${animClass}`}
          rowClassName="border-b border-border/70 last:border-b-0"
          renderDay={(info) => (
            <DayCell
              key={info.day}
              info={info}
              list={byDay.get(info.day)}
              apps={apps}
              today={today}
              slots={slots}
              compact={compact}
              drag={drag}
              chips={chips}
              actions={actions}
              focusable={info.day === focusedDay}
              onFocusDay={onFocusDay}
            />
          )}
        />
      </div>
    </div>
  );
}

const EMPTY: CalendarEvent[] = [];

const DayCell = memo(function DayCell({ info, list = EMPTY, apps, today, slots, compact, drag, chips, actions, focusable, onFocusDay }: {
  info: DayInfo;
  list?: CalendarEvent[];
  apps: Record<string, CalendarApp>;
  today: Ymd;
  slots: number;
  compact: boolean;
  drag: DragState | null;
  chips: ChipHandlers;
  actions: DayActions;
  focusable: boolean;
  onFocusDay: (day: Ymd) => void;
}) {
  const { day } = info;
  const target = drag?.day === day;
  const label = `${formatDay(day, { weekday: "long", month: "long", day: "numeric" })} · ${describeDay(list)}`;
  const tone = `${info.isWeekend ? "bg-control/35" : ""} ${target ? (drag!.allowed ? "!bg-primary/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]" : "!bg-destructive/[0.05]") : ""}`;

  if (compact) {
    const dots = list.slice(0, 4);
    return (
      <button
        type="button"
        data-day={day}
        role="gridcell"
        tabIndex={focusable ? 0 : -1}
        aria-label={label}
        onClick={() => { onFocusDay(day); actions.onOpenDay(day); }}
        className={`relative flex flex-col items-center gap-1 pt-1.5 border-r border-border/70 last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${tone}`}
      >
        <DayNumber info={info} size="sm" withMonthOnFirst={false} />
        {/* Shape tells actions from records: a deadline is a dash (red when
            overdue), a record a dot in its stage colour — Rejected is red too. */}
        <span className="flex items-center gap-[3px]" aria-hidden>
          {dots.map((e) => (
            <span key={e.id} className={e.kind === "deadline" ? "w-2 h-[3px] rounded-full" : "w-[5px] h-[5px] rounded-full"} style={{
              background: e.kind === "deadline" ? (isOverdue(e, today) ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.55)") : STAGE_COLOR[(e.kind === "stage" ? e.enteredStage : e.stage) ?? "Applied"],
              opacity: e.ghost ? 0.45 : 1,
            }} />
          ))}
        </span>
      </button>
    );
  }

  const { shown, hidden } = splitOverflow(list, slots);
  return (
    <div
      data-day={day}
      role="gridcell"
      tabIndex={focusable ? 0 : -1}
      aria-label={label}
      onFocus={(e) => { if (e.target === e.currentTarget) onFocusDay(day); }}
      onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) actions.onAdd(day); }}
      className={`group/day relative min-w-0 overflow-hidden border-r border-border/70 last:border-r-0 focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring)/0.5)] ${tone}`}
    >
      <div className="flex items-center justify-between pl-2 pr-1 pt-1" style={{ height: DATE_STRIP }}>
        <DayNumber info={info} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => actions.onAdd(day)}
          aria-label={`New deadline on ${formatDay(day, { month: "long", day: "numeric" })}`}
          className="w-5 h-5 grid place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-control hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
        >
          <Plus size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="px-1 flex flex-col gap-[2px]">
        {shown.map((e) => (
          <EventChip key={e.id} event={e} today={today} app={e.applicationId ? apps[e.applicationId] : undefined} dragging={!!drag} handlers={chips} />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={(ev) => actions.onPeek(day, ev.currentTarget.closest<HTMLElement>("[data-day]")!)}
            className="h-5 px-1.5 rounded-md text-left text-[11px] font-medium text-muted-foreground hover:bg-control hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {hidden} more
          </button>
        )}
      </div>
    </div>
  );
});
