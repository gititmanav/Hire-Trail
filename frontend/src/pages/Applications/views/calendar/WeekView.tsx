/** Week scale: seven day columns. Every event gets a full two-line chip —
 *  no "N more" at this scale; the columns scroll together. Date-only data, so
 *  no time grid. */
import { Plus } from "lucide-react";
import { weekDays, type CalendarEvent } from "../../../../utils/calendarGrid.ts";
import { formatDay, parseYmd, type Ymd } from "../../../../utils/dates.ts";
import type { CalendarApp } from "../../../../utils/api.ts";
import { dayLabel } from "../../../../components/ui/MonthGrid.tsx";
import { EventChip, type ChipHandlers } from "./parts.tsx";
import type { DragState } from "./useCalendarDrag.ts";
import type { DayActions } from "./MonthView.tsx";

export default function WeekView({ start, today, byDay, apps, animClass, drag, chips, actions, gridRef }: {
  start: Ymd;
  today: Ymd;
  byDay: Map<Ymd, CalendarEvent[]>;
  apps: Record<string, CalendarApp>;
  animClass: string;
  drag: DragState | null;
  chips: ChipHandlers;
  actions: DayActions;
  gridRef: (el: HTMLDivElement | null) => void;
}) {
  const days = weekDays(start);
  const weekend = (d: Ymd) => { const w = parseYmd(d)!.getDay(); return w === 0 || w === 6; };
  const target = (d: Ymd) => (drag?.day === d ? (drag.allowed ? "!bg-primary/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]" : "!bg-destructive/[0.05]") : "");

  return (
    <div key={start} className={`flex-1 min-h-0 flex flex-col ${animClass}`}>
      <div className="grid grid-cols-7 border-b border-border/70">
        {days.map((d) => (
          <div key={d} className={`group/day relative flex items-center gap-1.5 px-2 pb-1.5 border-r border-border/70 last:border-r-0 ${weekend(d) ? "bg-control/35" : ""}`}>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{formatDay(d, { weekday: "short" })}</span>
            <span className={`text-xs tabular-nums ${d === today ? "inline-grid place-items-center h-5 min-w-5 rounded-full bg-primary px-1.5 font-semibold text-primary-foreground" : "font-medium text-foreground/80"}`}>
              {dayLabel(d)}
            </span>
            <button
              type="button"
              onClick={() => actions.onAdd(d)}
              aria-label={`New deadline on ${formatDay(d, { month: "long", day: "numeric" })}`}
              className="absolute right-1 top-1/2 -translate-y-[calc(50%+3px)] w-5 h-5 grid place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-control hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Plus size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto scroll-quiet">
        <div className="grid grid-cols-7 min-h-full">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <div
                key={d}
                role="group"
                aria-label={formatDay(d, { weekday: "long", month: "long", day: "numeric" })}
                onDoubleClick={(e) => { if (e.currentTarget.contains(e.target as Node) && !(e.target as HTMLElement).closest("button")) actions.onAdd(d); }}
                className={`min-w-0 flex flex-col gap-0.5 p-1 border-r border-border/70 last:border-r-0 ${weekend(d) ? "bg-control/35" : ""} ${target(d)}`}
              >
                {list.map((e) => (
                  <EventChip key={e.id} event={e} today={today} app={e.applicationId ? apps[e.applicationId] : undefined} dragging={!!drag} lines={2} handlers={chips} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
