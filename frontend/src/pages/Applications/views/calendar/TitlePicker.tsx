/** The calendar's title ("September 2026", "Sep – Oct 2026", "Saturday,
 *  Sep 26 2026") is a button: it opens the mini calendar — days, with a
 *  drill-up to months and years — so any date is a few clicks away. Days with
 *  a deadline carry a dot; a red one when it's overdue. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import Popover from "../../../../components/ui/Popover.tsx";
import CalendarPicker, { type CalendarPickerHandle } from "../../../../components/ui/CalendarPicker.tsx";
import { visibleRange, type Scale } from "../../../../utils/calendarGrid.ts";
import { addDaysYmd, formatDay, monthOf, weekStartOf, ymdOf, type Ymd } from "../../../../utils/dates.ts";
import type { ApplicationFilters } from "../../data/filters.ts";
import { calendarParams, useCalendarRange } from "./data.ts";

export function titleParts(scale: Scale, anchor: Ymd, weekStart: number): { main: string; year: string } {
  if (scale === "month") return { main: formatDay(anchor, { month: "long" }), year: anchor.slice(0, 4) };
  if (scale === "day") return { main: formatDay(anchor, { weekday: "long", month: "short", day: "numeric" }), year: anchor.slice(0, 4) };
  const start = weekStartOf(anchor, weekStart);
  const end = addDaysYmd(start, 6);
  const same = start.slice(0, 7) === end.slice(0, 7);
  return {
    main: same ? formatDay(start, { month: "long" }) : `${formatDay(start, { month: "short" })} – ${formatDay(end, { month: "short" })}`,
    year: end.slice(0, 4),
  };
}

export default function TitlePicker({ scale, anchor, weekStart, today, filters, onPick }: {
  scale: Scale;
  anchor: Ymd;
  weekStart: number;
  today: Ymd;
  filters: ApplicationFilters | null;
  onPick: (day: Ymd) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<CalendarPickerHandle>(null);
  const [month, setMonth] = useState(() => monthOf(anchor));
  const { main, year } = titleParts(scale, anchor, weekStart);

  // Markers for the month the picker shows (cached like any calendar range).
  const range = visibleRange("month", ymdOf(month.year, month.month, 1), weekStart);
  const { data } = useCalendarRange(calendarParams(filters, range.from, range.to), { enabled: open });
  const marks = useMemo(() => {
    const m = new Map<Ymd, "dot" | "alert">();
    // Deadlines only — they're what you navigate to; records would dot every day.
    for (const e of data?.events ?? []) {
      if (e.kind !== "deadline" || e.date < range.from || e.date > range.to) continue;
      if (e.date < today) m.set(e.date, "alert");
      else if (!m.has(e.date)) m.set(e.date, "dot");
    }
    return m;
  }, [data, range.from, range.to, today]);

  useEffect(() => {
    if (!open) return;
    setMonth(monthOf(anchor));
    const raf = requestAnimationFrame(() => pickerRef.current?.focus());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const weekRange = scale === "week" ? { from: weekStartOf(anchor, weekStart), to: addDaysYmd(weekStartOf(anchor, weekStart), 6) } : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${main} ${year} — choose a date`}
        className="group -ml-1.5 inline-flex items-center gap-1.5 h-9 px-1.5 rounded-lg hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors min-w-0"
      >
        <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
          {main} <span className="font-normal text-muted-foreground">{year}</span>
        </h2>
        <ChevronDown size={15} strokeWidth={2} aria-hidden className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={triggerRef} width={296} ariaLabel="Go to date" autoFocus={false} className="p-3">
        <CalendarPicker
          ref={pickerRef}
          value={scale === "day" ? anchor : ""}
          initialDay={scale === "month" && today.slice(0, 7) === anchor.slice(0, 7) ? today : anchor}
          range={weekRange}
          marker={(d) => marks.get(d)}
          onMonthChange={(y, m) => setMonth({ year: y, month: m })}
          onPick={(d) => { setOpen(false); onPick(d); }}
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => { setOpen(false); onPick(today); }}
            className="text-xs font-medium text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
          >
            Today
          </button>
        </div>
      </Popover>
    </>
  );
}
