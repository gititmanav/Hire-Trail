/** The Dashboard's calendar card — a month of what's on, in the same visual
 *  language as the full calendar (ui/MonthGrid: week start, 6 rows, today
 *  pill, muted out-of-month days) so the two never read as different products.
 *
 *  - Hover a day with something on it → a card lists it; click a row to open it.
 *  - ‹ Today › pages the card only: it fetches its own range (GET /api/calendar),
 *    so browsing months never reloads the rest of the dashboard. Each month is
 *    its own cached query, so a response for a month already paged past can't
 *    land on the one on screen. */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MonthGrid, { DayNumber, WeekdayHeader } from "../ui/MonthGrid.tsx";
import HoverCard from "../ui/HoverCard.tsx";
import { DeadlineTypeIcon } from "../DeadlineFormModal/DeadlineFormModal.tsx";
import { groupByDay, visibleRange, type CalendarEvent } from "../../utils/calendarGrid.ts";
import { formatDay, shiftMonth, todayYmd, weekStartDay, ymdOf, type Ymd } from "../../utils/dates.ts";
import { STAGE_COLOR } from "../../utils/stageStyles.ts";
import { calendarParams, useCalendarRange } from "../../pages/Applications/views/calendar/data.ts";

function dotColor(e: CalendarEvent, today: Ymd): string {
  if (e.kind === "deadline") return e.date < today ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.55)";
  const stage = e.kind === "stage" ? e.enteredStage : e.stage;
  return stage ? STAGE_COLOR[stage] : "hsl(var(--muted-foreground))";
}

export default function DashboardCalendarCard() {
  const navigate = useNavigate();
  const today = todayYmd();
  const weekStart = useMemo(() => weekStartDay(), []);
  const [offset, setOffsetState] = useState(0);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const setOffset = (next: number) => { if (next === offset) return; setDir(next > offset ? "next" : "prev"); setOffsetState(next); };
  const base = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
  const { year, month } = shiftMonth(base.year, base.month, offset);
  const range = visibleRange("month", ymdOf(year, month, 1), weekStart);
  const { data, isLoading } = useCalendarRange(calendarParams(null, range.from, range.to));
  const byDay = useMemo(() => groupByDay((data?.events ?? []).filter((e) => e.date >= range.from && e.date <= range.to), today), [data, range.from, range.to, today]);

  const open = (e: CalendarEvent) => {
    if (e.applicationId) navigate(`/applications/${e.applicationId}`);
    else navigate(`/applications/calendar?d=${e.date}`);
  };

  const navBtn = "w-6 h-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors";
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {formatDay(ymdOf(year, month, 1), { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous month" className={navBtn}><ChevronLeft size={14} strokeWidth={2} aria-hidden /></button>
          <button type="button" onClick={() => setOffset(0)} className="h-6 px-2 rounded-md text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">Today</button>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next month" className={navBtn}><ChevronRight size={14} strokeWidth={2} aria-hidden /></button>
          <Link to="/applications/calendar" className="ml-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">Open full</Link>
        </div>
      </div>
      <WeekdayHeader weekStart={weekStart} width="narrow" className="border-b border-border/70" cellClassName="pb-1 text-center text-[10.5px] font-medium text-muted-foreground" />
      <MonthGrid
        key={`${year}-${month}`}
        year={year}
        month={month}
        weekStart={weekStart}
        today={today}
        className={`flex-1 min-h-0 ${dir ? `cal-in-${dir}` : ""} ${isLoading ? "opacity-60" : ""}`}
        rowClassName="border-b border-border/70 last:border-b-0"
        renderDay={(info) => {
          const list = byDay.get(info.day) ?? [];
          const cell = (
            <div className={`h-full flex flex-col items-center justify-center gap-[3px] ${info.isWeekend ? "bg-control/35" : ""}`}>
              <DayNumber info={info} size="sm" withMonthOnFirst={false} />
              <span className="flex gap-[3px] h-[5px]" aria-hidden>
                {list.slice(0, 3).map((e) => <span key={e.id} className={e.kind === "deadline" ? "w-2 h-[3px] rounded-full self-center" : "w-[5px] h-[5px] rounded-full"} style={{ background: dotColor(e, today) }} />)}
              </span>
            </div>
          );
          if (list.length === 0) return <div key={info.day} className="border-r border-border/70 last:border-r-0">{cell}</div>;
          return (
            <HoverCard
              key={info.day}
              className="flex border-r border-border/70 last:border-r-0 cursor-default"
              width={260}
              openDelay={180}
              ariaLabel={formatDay(info.day, { weekday: "long", month: "long", day: "numeric" })}
              content={
                <div className="p-1.5">
                  <p className="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-foreground">{formatDay(info.day, { weekday: "short", month: "short", day: "numeric" })}</p>
                  <div className="max-h-64 overflow-y-auto scroll-quiet flex flex-col">
                    {list.map((e) => (
                      <button key={e.id} type="button" onClick={() => open(e)} className="flex items-center gap-2 min-h-8 px-2 rounded-lg text-left text-[12.5px] hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                        {e.kind === "deadline"
                          ? <DeadlineTypeIcon type={e.title} size={13} className={e.date < today ? "text-destructive" : "text-foreground/60"} />
                          : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor(e, today) }} />}
                        <span className="truncate">
                          <span className={e.kind === "deadline" ? `font-semibold ${e.date < today ? "text-destructive" : "text-foreground"}` : "font-medium text-foreground"}>{e.kind === "deadline" ? e.title : e.company}</span>
                          <span className="text-muted-foreground">{e.kind === "deadline" ? (e.company ? ` · ${e.company}` : "") : e.kind === "stage" ? ` → ${e.enteredStage}` : " · applied"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              <button type="button" className="w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-sm" aria-label={`${formatDay(info.day, { weekday: "long", month: "long", day: "numeric" })}, ${list.length} item${list.length === 1 ? "" : "s"}`}>
                {cell}
              </button>
            </HoverCard>
          );
        }}
      />
    </div>
  );
}
