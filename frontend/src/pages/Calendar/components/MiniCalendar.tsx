/** Compact month grid for quick date navigation. Click any day → main calendar jumps. */
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";

interface Props {
  value: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  /** ISO yyyy-mm-dd → count of events on that day, for the dot indicator. */
  eventDays?: Set<string>;
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function MiniCalendar({ value, selected, onSelect, onMonthChange, eventDays }: Props) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(value), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(value), { weekStartsOn: 1 });
    const out: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [value]);

  return (
    <div className="mini-cal">
      <div className="mini-cal__header">
        <button type="button" className="mini-cal__nav" onClick={() => onMonthChange(addMonths(value, -1))} aria-label="Previous month">
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <button type="button" className="mini-cal__label" onClick={() => onMonthChange(today)} title="Jump to current month">
          {format(value, "MMMM yyyy")}
        </button>
        <button type="button" className="mini-cal__nav" onClick={() => onMonthChange(addMonths(value, 1))} aria-label="Next month">
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="mini-cal__grid">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="mini-cal__wd">{d}</span>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, value);
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selected);
          const iso = d.toISOString().slice(0, 10);
          const hasEvents = eventDays?.has(iso) ?? false;
          return (
            <button
              key={iso}
              type="button"
              className={`mini-cal__day ${inMonth ? "" : "mini-cal__day--muted"} ${isToday ? "mini-cal__day--today" : ""} ${isSelected ? "mini-cal__day--selected" : ""}`}
              onClick={() => onSelect(d)}
              aria-label={format(d, "EEEE, MMMM d, yyyy")}
              aria-pressed={isSelected}
            >
              <span>{d.getDate()}</span>
              {hasEvents && <span className="mini-cal__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
