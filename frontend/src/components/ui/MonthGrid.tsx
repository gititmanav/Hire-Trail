/** The one month grid. The calendar's Month view, the date picker
 *  (CalendarPicker → DateInput, the calendar title's month picker) and the
 *  Dashboard calendar card all lay out their days through this, so they can't
 *  drift apart: same week start, always 6 rows, the same today pill, muted
 *  out-of-month days and "Oct 1" cue.
 *
 *  It owns the geometry and the day facts; the caller renders each cell. */
import { forwardRef, ReactNode, useMemo } from "react";
import { monthWeeks } from "../../utils/calendarGrid.ts";
import { weekdayNames, weekdayOrder, type Ymd } from "../../utils/dates.ts";

export interface DayInfo {
  day: Ymd;
  row: number;
  col: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "17", or "Oct 1" on the first of a month (Apple's cue that the grid rolled over). */
export function dayLabel(day: Ymd, withMonthOnFirst = true): string {
  const n = Number(day.slice(8, 10));
  return n === 1 && withMonthOnFirst ? `${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]} 1` : String(n);
}

/** A day's numeral: the brand pill on today, muted outside the month. */
export function DayNumber({ info, size = "md", withMonthOnFirst = true }: { info: DayInfo; size?: "sm" | "md"; withMonthOnFirst?: boolean }) {
  const label = dayLabel(info.day, withMonthOnFirst);
  const base = size === "sm" ? "text-[12px] h-[18px] min-w-[18px]" : "text-xs h-5 min-w-5";
  if (info.isToday) {
    return <span className={`${base} inline-grid place-items-center rounded-full bg-primary px-1.5 font-semibold text-primary-foreground tabular-nums`}>{label}</span>;
  }
  return (
    <span className={`${base} inline-flex items-center font-medium tabular-nums ${info.inMonth ? "text-foreground/80" : "text-muted-foreground/45"}`}>
      {label}
    </span>
  );
}

/** Weekday labels in week-start order. */
export function WeekdayHeader({ weekStart, width = "short", className = "", cellClassName = "" }: {
  weekStart: number;
  width?: "short" | "narrow";
  className?: string;
  cellClassName?: string;
}) {
  const names = useMemo(() => weekdayNames(weekStart, width), [weekStart, width]);
  return (
    <div className={`grid grid-cols-7 ${className}`} aria-hidden>
      {names.map((n, i) => <span key={i} className={cellClassName}>{n}</span>)}
    </div>
  );
}

interface MonthGridProps {
  year: number;
  /** 0-based. */
  month: number;
  weekStart: number;
  today: Ymd;
  renderDay: (info: DayInfo) => ReactNode;
  className?: string;
  rowClassName?: string;
  role?: string;
  ariaLabel?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
}

const MonthGrid = forwardRef<HTMLDivElement, MonthGridProps>(function MonthGrid(
  { year, month, weekStart, today, renderDay, className = "", rowClassName = "", role, ariaLabel, tabIndex, onKeyDown, style },
  ref,
) {
  const weeks = useMemo(() => monthWeeks(year, month, weekStart), [year, month, weekStart]);
  const order = useMemo(() => weekdayOrder(weekStart), [weekStart]);
  return (
    <div ref={ref} role={role} aria-label={ariaLabel} tabIndex={tabIndex} onKeyDown={onKeyDown} style={style} className={`grid grid-rows-6 ${className}`}>
      {weeks.map((days, row) => (
        <div key={days[0]} role={role === "grid" ? "row" : undefined} className={`grid grid-cols-7 min-h-0 ${rowClassName}`}>
          {days.map((day, col) =>
            renderDay({
              day,
              row,
              col,
              inMonth: Number(day.slice(5, 7)) - 1 === month,
              isToday: day === today,
              isWeekend: order[col] === 0 || order[col] === 6,
            }),
          )}
        </div>
      ))}
    </div>
  );
});

export default MonthGrid;
