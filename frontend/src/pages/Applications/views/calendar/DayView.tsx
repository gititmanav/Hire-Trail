/** Day scale: one day as a list — "what do I do today?". No time grid (every
 *  event is date-only). On today, every overdue deadline is pinned first.
 *  Deadlines carry their actions on the row (complete, reschedule, more);
 *  records open their application. On phones a week strip sits on top. */
import { useMemo, useRef, useState } from "react";
import { CalendarClock, Check, MoreHorizontal, Plus } from "lucide-react";
import Menu from "../../../../components/ui/Menu.tsx";
import Popover from "../../../../components/ui/Popover.tsx";
import CalendarPicker from "../../../../components/ui/CalendarPicker.tsx";
import CompanyLogo from "../../../../components/CompanyLogo/CompanyLogo.tsx";
import Tooltip from "../../../../components/ui/Tooltip.tsx";
import { DeadlineTypeIcon } from "../../../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { overdueDeadlines, weekDays, type CalendarEvent } from "../../../../utils/calendarGrid.ts";
import { diffDaysYmd, formatDay, relativeDay, weekStartOf, type Ymd } from "../../../../utils/dates.ts";
import { STAGE_COLOR } from "../../../../utils/stageStyles.ts";
import type { CalendarApp } from "../../../../utils/api.ts";
import { useCompanies } from "../../data/queries.ts";
import { isOverdue, StageDot } from "./parts.tsx";
import type { DeadlineActions } from "./DeadlinePopover.tsx";

export default function DayView({
  day, today, weekStart, events, apps, animClass, compact, onSelectDay, onAdd, onOpenDeadline, onOpenApplication, actions,
}: {
  day: Ymd;
  today: Ymd;
  weekStart: number;
  /** Everything loaded for the range (the day's events + overdue deadlines). */
  events: CalendarEvent[];
  apps: Record<string, CalendarApp>;
  animClass: string;
  compact: boolean;
  onSelectDay: (day: Ymd) => void;
  onAdd: (day: Ymd) => void;
  onOpenDeadline: (e: CalendarEvent, el: HTMLElement) => void;
  onOpenApplication: (applicationId: string) => void;
  actions: DeadlineActions;
}) {
  const { data: companies = [] } = useCompanies();
  const logoFor = useMemo(() => {
    const byId = new Map(companies.map((c) => [c._id, c.logoUrl]));
    const byName = new Map(companies.map((c) => [c.name.toLowerCase(), c.logoUrl]));
    return (app?: CalendarApp) => (app ? (app.companyId ? byId.get(app.companyId) : undefined) ?? byName.get(app.company.toLowerCase()) : undefined);
  }, [companies]);

  const onDay = events.filter((e) => e.date === day);
  const overdue = day === today ? overdueDeadlines(events, today) : [];
  const due = onDay.filter((e) => e.kind === "deadline");
  const stages = onDay.filter((e) => e.kind === "stage");
  const applied = onDay.filter((e) => e.kind === "applied");
  const empty = overdue.length + onDay.length === 0;

  const row = (e: CalendarEvent) => (
    <DayRow
      key={e.id}
      event={e}
      today={today}
      app={e.applicationId ? apps[e.applicationId] : undefined}
      logoUrl={logoFor(e.applicationId ? apps[e.applicationId] : undefined)}
      onOpen={(el) => (e.kind === "deadline" ? onOpenDeadline(e, el) : e.applicationId && onOpenApplication(e.applicationId))}
      actions={actions}
      onOpenApplication={onOpenApplication}
    />
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {compact && <WeekStrip day={day} today={today} weekStart={weekStart} events={events} onSelect={onSelectDay} />}
      <div key={day} className={`flex-1 min-h-0 overflow-y-auto scroll-quiet ${animClass}`}>
        <div className="max-w-[760px] pb-6">
          {empty ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium text-foreground">{day === today ? "Nothing on today" : "Nothing on this day"}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">No deadlines, applications or stage changes.</p>
              <button
                type="button"
                onClick={() => onAdd(day)}
                className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[13px] font-medium text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <Plus size={14} strokeWidth={2} aria-hidden /> New deadline
              </button>
            </div>
          ) : (
            <>
              <Section label="Overdue" tone="danger" count={overdue.length}>{overdue.map(row)}</Section>
              <Section label={day === today ? "Due today" : "Due"} count={due.length} onAdd={() => onAdd(day)}>{due.map(row)}</Section>
              <Section label="Stage changes" count={stages.length}>{stages.map(row)}</Section>
              <Section label="Applied" count={applied.length}>{applied.map(row)}</Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, count, tone, onAdd, children }: { label: string; count: number; tone?: "danger"; onAdd?: () => void; children: React.ReactNode }) {
  if (count === 0 && !onAdd) return null;
  return (
    <section className="pt-4 first:pt-1">
      <div className="sticky top-0 z-[1] bg-background flex items-center justify-between px-2 py-1.5">
        <h3 className={`text-[11px] font-medium uppercase tracking-[0.08em] ${tone === "danger" ? "text-destructive" : "text-muted-foreground/80"}`}>
          {label} <span className="tabular-nums">· {count}</span>
        </h3>
        {onAdd && (
          <button type="button" onClick={onAdd} aria-label="New deadline" className="w-6 h-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
      {count === 0 ? <p className="px-2 py-1 text-[13px] text-muted-foreground">Nothing due.</p> : <div className="flex flex-col">{children}</div>}
    </section>
  );
}

function DayRow({ event, today, app, logoUrl, onOpen, actions, onOpenApplication }: {
  event: CalendarEvent;
  today: Ymd;
  app?: CalendarApp;
  logoUrl?: string;
  onOpen: (el: HTMLElement) => void;
  actions: DeadlineActions;
  onOpenApplication: (id: string) => void;
}) {
  const overdue = isOverdue(event, today);
  const [picking, setPicking] = useState(false);
  const pickRef = useRef<HTMLButtonElement>(null);
  const stage = event.kind === "stage" ? event.enteredStage : app?.stage ?? event.stage;
  const isDeadline = event.kind === "deadline";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { if (e.currentTarget.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-row-action]")) onOpen(e.currentTarget); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(e.currentTarget); }}
      className="group/row flex items-center gap-3 min-h-11 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-control/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
      <span className="w-5 flex justify-center shrink-0">
        {isDeadline
          ? <DeadlineTypeIcon type={event.title} size={15} className={overdue ? "text-destructive" : "text-foreground/60"} />
          : <StageDot stage={stage} className="!w-2 !h-2" />}
      </span>
      <span className="min-w-0 flex-1 flex items-baseline gap-2">
        {/* The Overdue section already says so: the glyph and the day count carry the red, not the title. */}
        <span className={`truncate text-[13.5px] text-foreground ${isDeadline ? "font-semibold" : "font-medium"}`}>
          {isDeadline ? event.title : event.company}
          {event.kind === "stage" && <span className="font-normal text-muted-foreground"> → {event.enteredStage}</span>}
        </span>
        {(isDeadline ? event.company : event.role) && (
          <span className="hidden sm:inline-flex items-center gap-1.5 min-w-0 text-[13px] text-muted-foreground">
            {isDeadline && app && <CompanyLogo name={app.company} logoUrl={logoUrl} size="2xs" />}
            <span className="truncate">{isDeadline ? [event.company, event.role].filter(Boolean).join(" · ") : event.role}</span>
          </span>
        )}
      </span>
      {/* Applied rows show where the application stands now; a stage row already says it. */}
      {isDeadline ? (
        <span className={`shrink-0 text-[12px] tabular-nums ${overdue ? "text-destructive/85" : "text-muted-foreground"}`}>
          {overdue ? `${-diffDaysYmd(today, event.date)}d overdue` : relativeDay(event.date, today)}
        </span>
      ) : event.kind === "applied" && stage && (
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground/85 bg-[color-mix(in_oklab,var(--stage)_14%,transparent)]" style={{ ["--stage" as string]: STAGE_COLOR[stage] }}>
          <StageDot stage={stage} />{stage}
        </span>
      )}
      {isDeadline && !event.ghost && (
        <span data-row-action className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity [@media(hover:none)]:opacity-100">
          <Tooltip label="Mark complete">
            <button type="button" aria-label={`Mark ${event.title} complete`} onClick={() => actions.complete(event)} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Check size={15} strokeWidth={1.8} aria-hidden />
            </button>
          </Tooltip>
          <Tooltip label="Reschedule">
            <button ref={pickRef} type="button" aria-label={`Reschedule ${event.title}`} onClick={() => setPicking((p) => !p)} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CalendarClock size={15} strokeWidth={1.8} aria-hidden />
            </button>
          </Tooltip>
          <Popover open={picking} onOpenChange={setPicking} anchorRef={pickRef} align="end" width={296} ariaLabel={`Reschedule ${event.title}`} className="p-3">
            <CalendarPicker value={event.date} onPick={(d) => { setPicking(false); if (d !== event.date) actions.reschedule(event, d); }} />
          </Popover>
          <Menu
            ariaLabel={`${event.title} actions`}
            align="end"
            trigger={
              <button type="button" aria-label="More actions" className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden />
              </button>
            }
            items={[
              { label: "Edit", onSelect: () => actions.edit(event) },
              ...(event.applicationId ? [{ label: "Open application", onSelect: () => onOpenApplication(event.applicationId!) }] : []),
              { label: "Delete", destructive: true, onSelect: () => actions.remove(event) },
            ]}
          />
        </span>
      )}
    </div>
  );
}

/** Phones: the week around the day, one tap to move. Dots mark busy days. */
function WeekStrip({ day, today, weekStart, events, onSelect }: { day: Ymd; today: Ymd; weekStart: number; events: CalendarEvent[]; onSelect: (d: Ymd) => void }) {
  const days = weekDays(weekStartOf(day, weekStart));
  const busy = new Set(events.map((e) => e.date));
  return (
    <div className="grid grid-cols-7 gap-1 pb-2 mb-1 border-b border-border/70">
      {days.map((d) => {
        const selected = d === day;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-label={formatDay(d, { weekday: "long", month: "long", day: "numeric" })}
            aria-pressed={selected}
            className="flex flex-col items-center gap-1 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-[10.5px] font-medium uppercase text-muted-foreground">{formatDay(d, { weekday: "narrow" })}</span>
            <span className={`h-7 min-w-7 px-1 grid place-items-center rounded-full text-[13px] tabular-nums ${
              selected ? "bg-primary text-primary-foreground font-semibold" : d === today ? "text-primary font-semibold ring-1 ring-inset ring-primary/50" : "text-foreground"
            }`}>
              {Number(d.slice(8, 10))}
            </span>
            <span aria-hidden className={`w-1 h-1 rounded-full ${busy.has(d) ? "bg-muted-foreground/60" : "bg-transparent"}`} />
          </button>
        );
      })}
    </div>
  );
}
