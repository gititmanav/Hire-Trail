/** The date picker panel: days, with a drill-up to months and years so any
 *  date is a few clicks away ("September 2026" → the year's months → a dozen
 *  years). Used inside a Popover by DateInput and by the calendar's title.
 *
 *  Keyboard: arrows move the cursor (a day / a month / a year), PageUp/Down
 *  page, Home/End jump to the row's ends, Enter picks, Escape closes the
 *  surrounding popover. Days are `YYYY-MM-DD` strings (utils/dates.ts). */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MonthGrid, { WeekdayHeader } from "./MonthGrid.tsx";
import {
  addDaysYmd, formatDay, monthOf, parseYmd, shiftMonth, todayYmd, weekStartDay, ymdOf, type Ymd,
} from "../../utils/dates.ts";

type Level = "days" | "months" | "years";
const YEARS_PER_PAGE = 12;

export interface CalendarPickerHandle { focus: () => void }

export interface CalendarPickerProps {
  /** The picked day, highlighted. */
  value?: Ymd | "";
  onPick: (day: Ymd) => void;
  /** Month shown first (defaults to `value`, else today). */
  initialDay?: Ymd;
  /** Days shaded as a band — the calendar's current week. */
  range?: { from: Ymd; to: Ymd };
  /** A quiet dot under a day ("dot") or a destructive one ("alert"). */
  marker?: (day: Ymd) => "dot" | "alert" | undefined;
  /** The month on screen changed (fetch its markers). */
  onMonthChange?: (year: number, month: number) => void;
  className?: string;
}

const CalendarPicker = forwardRef<CalendarPickerHandle, CalendarPickerProps>(function CalendarPicker(
  { value, onPick, initialDay, range, marker, onMonthChange, className = "" },
  ref,
) {
  const today = todayYmd();
  const weekStart = weekStartDay();
  const start = initialDay || value || today;
  const [level, setLevel] = useState<Level>("days");
  const [view, setView] = useState(() => monthOf(start));
  /** Keyboard cursor: a day (days), a month index y*12+m (months), a year (years). */
  const [cursorDay, setCursorDay] = useState<Ymd>(start);
  const [cursorMonth, setCursorMonth] = useState(() => monthOf(start).year * 12 + monthOf(start).month);
  const [cursorYear, setCursorYear] = useState(() => monthOf(start).year);
  const gridRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => gridRef.current?.focus({ preventScroll: true }) }), []);
  // A new level takes focus so the keyboard keeps working after a drill.
  useLayoutEffect(() => { if (document.activeElement && gridRef.current?.parentElement?.contains(document.activeElement)) gridRef.current.focus({ preventScroll: true }); }, [level]);
  useEffect(() => { onMonthChange?.(view.year, view.month); }, [view.year, view.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const showMonth = (year: number, month: number) => setView({ year, month });

  /* ─── Header ─── */
  const pageYearsFrom = Math.floor(view.year / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  const title = level === "days"
    ? formatDay(ymdOf(view.year, view.month, 1), { month: "long", year: "numeric" })
    : level === "months" ? String(view.year) : `${pageYearsFrom} – ${pageYearsFrom + YEARS_PER_PAGE - 1}`;
  const page = (dir: 1 | -1) => {
    if (level === "days") {
      const next = shiftMonth(view.year, view.month, dir);
      showMonth(next.year, next.month);
      setCursorDay(clampDayToMonth(cursorDay, next.year, next.month));
    } else if (level === "months") {
      setView((v) => ({ ...v, year: v.year + dir }));
      setCursorMonth((c) => c + dir * 12);
    } else {
      setView((v) => ({ ...v, year: v.year + dir * YEARS_PER_PAGE }));
      setCursorYear((c) => c + dir * YEARS_PER_PAGE);
    }
  };
  const drillUp = () => {
    if (level === "days") { setCursorMonth(view.year * 12 + view.month); setLevel("months"); }
    else if (level === "months") { setCursorYear(view.year); setLevel("years"); }
  };

  /* ─── Keyboard ─── */
  const onDaysKey = (e: React.KeyboardEvent) => {
    const move = (n: number) => {
      e.preventDefault();
      const next = addDaysYmd(cursorDay, n);
      setCursorDay(next);
      const m = monthOf(next);
      if (m.year !== view.year || m.month !== view.month) showMonth(m.year, m.month);
    };
    const pageBy = (n: number) => {
      e.preventDefault();
      const { year, month } = monthOf(cursorDay);
      const next = shiftMonth(year, month, n);
      const d = clampDayToMonth(cursorDay, next.year, next.month);
      setCursorDay(d);
      showMonth(next.year, next.month);
    };
    const col = (parseYmd(cursorDay)!.getDay() - weekStart + 7) % 7;
    switch (e.key) {
      case "ArrowLeft": move(-1); break;
      case "ArrowRight": move(1); break;
      case "ArrowUp": move(-7); break;
      case "ArrowDown": move(7); break;
      case "Home": move(-col); break;
      case "End": move(6 - col); break;
      case "PageUp": pageBy(e.shiftKey ? -12 : -1); break;
      case "PageDown": pageBy(e.shiftKey ? 12 : 1); break;
      case "Enter": case " ": e.preventDefault(); onPick(cursorDay); break;
    }
  };
  const onMonthsKey = (e: React.KeyboardEvent) => {
    const move = (n: number) => {
      e.preventDefault();
      const next = cursorMonth + n;
      setCursorMonth(next);
      setView((v) => ({ ...v, year: Math.floor(next / 12) }));
    };
    switch (e.key) {
      case "ArrowLeft": move(-1); break;
      case "ArrowRight": move(1); break;
      case "ArrowUp": move(-3); break;
      case "ArrowDown": move(3); break;
      case "PageUp": move(-12); break;
      case "PageDown": move(12); break;
      case "Enter": case " ": e.preventDefault(); pickMonth(Math.floor(cursorMonth / 12), cursorMonth % 12); break;
    }
  };
  const onYearsKey = (e: React.KeyboardEvent) => {
    const move = (n: number) => {
      e.preventDefault();
      const next = cursorYear + n;
      setCursorYear(next);
      setView((v) => ({ ...v, year: next }));
    };
    switch (e.key) {
      case "ArrowLeft": move(-1); break;
      case "ArrowRight": move(1); break;
      case "ArrowUp": move(-3); break;
      case "ArrowDown": move(3); break;
      case "PageUp": move(-YEARS_PER_PAGE); break;
      case "PageDown": move(YEARS_PER_PAGE); break;
      case "Enter": case " ": e.preventDefault(); pickYear(cursorYear); break;
    }
  };

  const pickMonth = (year: number, month: number) => {
    showMonth(year, month);
    setCursorDay(clampDayToMonth(cursorDay, year, month));
    setLevel("days");
  };
  const pickYear = (year: number) => {
    setView((v) => ({ ...v, year }));
    setCursorMonth(year * 12 + view.month);
    setLevel("months");
  };

  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, m) => new Date(2023, m, 1).toLocaleDateString(undefined, { month: "short" })), []);
  const todayM = monthOf(today);

  const navBtn = "w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const tile = (active: boolean, current: boolean, cursor: boolean) =>
    `h-10 rounded-lg text-[13px] tabular-nums transition-colors focus:outline-none ${
      active ? "bg-primary text-primary-foreground font-semibold" : current ? "text-foreground font-semibold ring-1 ring-inset ring-border hover:bg-control" : "text-foreground hover:bg-control"
    } ${cursor ? "group-focus-visible/grid:ring-2 group-focus-visible/grid:ring-ring/60" : ""}`;

  return (
    <div className={`select-none ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => page(-1)} aria-label={level === "days" ? "Previous month" : level === "months" ? "Previous year" : "Earlier years"} className={navBtn}>
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={drillUp}
          disabled={level === "years"}
          aria-live="polite"
          aria-label={level === "days" ? `${title} — choose a month` : level === "months" ? `${title} — choose a year` : title}
          className="h-7 px-2 rounded-md text-[13px] font-semibold text-foreground hover:bg-control disabled:hover:bg-transparent disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          {title}
        </button>
        <button type="button" onClick={() => page(1)} aria-label={level === "days" ? "Next month" : level === "months" ? "Next year" : "Later years"} className={navBtn}>
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {level === "days" && (
        <>
          <WeekdayHeader weekStart={weekStart} width="narrow" className="mb-1" cellClassName="h-7 flex items-center justify-center text-[11px] font-medium text-muted-foreground" />
          <MonthGrid
            ref={gridRef}
            year={view.year}
            month={view.month}
            weekStart={weekStart}
            today={today}
            role="grid"
            ariaLabel={title}
            tabIndex={0}
            onKeyDown={onDaysKey}
            className="group/grid gap-y-0.5 rounded-lg focus:outline-none"
            renderDay={(info) => {
              const selected = info.day === value;
              const cursor = info.day === cursorDay;
              const inRange = !!range && info.day >= range.from && info.day <= range.to;
              const mark = marker?.(info.day);
              return (
                <div key={info.day} role="gridcell" className={`relative flex justify-center ${inRange ? "bg-control" : ""} ${inRange && info.day === range!.from ? "rounded-l-lg" : ""} ${inRange && info.day === range!.to ? "rounded-r-lg" : ""}`}>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={formatDay(info.day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    aria-pressed={selected}
                    aria-current={info.isToday ? "date" : undefined}
                    onClick={() => { setCursorDay(info.day); onPick(info.day); }}
                    className={`relative h-8 w-8 flex items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : info.isToday
                          ? "text-primary font-semibold ring-1 ring-inset ring-primary/50 hover:bg-control"
                          : info.inMonth ? "text-foreground hover:bg-control" : "text-muted-foreground/45 hover:bg-control"
                    } ${cursor ? "group-focus-visible/grid:ring-2 group-focus-visible/grid:ring-ring/60" : ""}`}
                  >
                    {Number(info.day.slice(8, 10))}
                    {mark && (
                      <span aria-hidden className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                        selected ? "bg-primary-foreground" : mark === "alert" ? "bg-destructive" : "bg-muted-foreground/60"
                      }`} />
                    )}
                  </button>
                </div>
              );
            }}
          />
        </>
      )}

      {level === "months" && (
        <div ref={gridRef} role="grid" aria-label={title} tabIndex={0} onKeyDown={onMonthsKey} className="group/grid grid grid-cols-3 gap-1.5 py-1 rounded-lg focus:outline-none">
          {monthNames.map((name, m) => {
            const idx = view.year * 12 + m;
            const selectedMonth = !!value && monthOf(value).year === view.year && monthOf(value).month === m;
            return (
              <button key={m} type="button" tabIndex={-1} onClick={() => pickMonth(view.year, m)}
                aria-label={formatDay(ymdOf(view.year, m, 1), { month: "long", year: "numeric" })}
                className={tile(selectedMonth, todayM.year === view.year && todayM.month === m, cursorMonth === idx)}>
                {name}
              </button>
            );
          })}
        </div>
      )}

      {level === "years" && (
        <div ref={gridRef} role="grid" aria-label={title} tabIndex={0} onKeyDown={onYearsKey} className="group/grid grid grid-cols-3 gap-1.5 py-1 rounded-lg focus:outline-none">
          {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageYearsFrom + i).map((y) => (
            <button key={y} type="button" tabIndex={-1} onClick={() => pickYear(y)}
              className={tile(!!value && monthOf(value).year === y, todayM.year === y, cursorYear === y)}>
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/** The same day-of-month in another month, clamped to its length (Jan 31 → Feb 28). */
function clampDayToMonth(day: Ymd, year: number, month: number): Ymd {
  const want = Number(day.slice(8, 10));
  const last = Number(ymdOf(year, month + 1, 0).slice(8, 10));
  return ymdOf(year, month, Math.min(want, last));
}

export default CalendarPicker;
