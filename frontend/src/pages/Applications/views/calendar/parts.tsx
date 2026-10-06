/** The calendar's pieces of an event: the chip (month / week), the full row
 *  (day peek, Day view), and the hover card behind both.
 *
 *  Chip language — text is the interface, colour an accent:
 *   - a deadline (an action): its type glyph + **type** · company; overdue
 *     turns the glyph and text destructive (one quiet signal);
 *   - a record (applied, stage entry): a stage-colour dot + company; a stage
 *     entry adds "→ Interview";
 *   - a repeat ghost: the deadline, dimmed, dashed outline.
 *  Hover washes a chip in its own colour. */
import { createContext, memo, ReactNode, useContext, useMemo } from "react";
import { ArrowUpRight, Repeat } from "lucide-react";
import HoverCard from "../../../../components/ui/HoverCard.tsx";
import CompanyLogo from "../../../../components/CompanyLogo/CompanyLogo.tsx";
import { DeadlineTypeIcon } from "../../../../components/DeadlineFormModal/DeadlineFormModal.tsx";
import { STAGE_COLOR } from "../../../../utils/stageStyles.ts";
import { diffDaysYmd, formatDay, relativeDay, type Ymd } from "../../../../utils/dates.ts";
import { formatScore } from "../../../../utils/matchScore.ts";
import type { CalendarEvent } from "../../../../utils/calendarGrid.ts";
import type { CalendarApp } from "../../../../utils/api.ts";
import { useCompanies, useContacts, useResumes } from "../../data/queries.ts";
import type { Stage } from "../../../../types";

/** How the calendar opens things: an application through the list's
 *  navigation memory (J/K, Back), anything else as a route. */
export const CalendarOpenContext = createContext<(path: string) => void>(() => {});

export const isOverdue = (e: CalendarEvent, today: Ymd) => e.kind === "deadline" && !e.ghost && e.date < today;

/** The colour a chip washes in on hover (and a record's dot). */
function chipColor(e: CalendarEvent, today: Ymd): string {
  if (e.kind === "deadline") return isOverdue(e, today) ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
  const stage = e.kind === "stage" ? e.enteredStage ?? e.stage : e.stage;
  return stage ? STAGE_COLOR[stage] : "hsl(var(--muted-foreground))";
}

export function StageDot({ stage, className = "" }: { stage?: Stage; className?: string }) {
  return <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${className}`} style={{ background: stage ? STAGE_COLOR[stage] : "hsl(var(--muted-foreground))" }} />;
}

/** "Thank you note, Stripe, due Thu Sep 24 (2 days ago)" — a chip's accessible name. */
export function eventLabel(e: CalendarEvent, today: Ymd): string {
  const when = formatDay(e.date, { weekday: "short", month: "short", day: "numeric" });
  if (e.kind === "deadline") {
    const rel = isOverdue(e, today) ? `${-diffDaysYmd(today, e.date)} days overdue` : relativeDay(e.date, today).toLowerCase();
    return `${e.title}${e.company ? `, ${e.company}` : ""}, due ${when} (${rel})${e.ghost ? ", upcoming repeat" : ""}`;
  }
  if (e.kind === "stage") return `${e.company} moved to ${e.enteredStage} on ${when}`;
  return `Applied to ${e.company}${e.role ? ` (${e.role})` : ""} on ${when}`;
}

/* ─── Chip (month cells, week columns) ─── */

export interface ChipHandlers {
  onClick: (e: CalendarEvent, el: HTMLElement) => void;
  onPointerDown?: (ev: React.PointerEvent, e: CalendarEvent) => void;
}

export const EventChip = memo(function EventChip({ event, today, app, dragging, lines = 1, handlers }: {
  event: CalendarEvent;
  today: Ymd;
  app?: CalendarApp;
  /** A drag is live somewhere — hover cards stay shut. */
  dragging: boolean;
  /** 2 = the Week view's two-line chip (role / company on the second line). */
  lines?: 1 | 2;
  handlers: ChipHandlers;
}) {
  const overdue = isOverdue(event, today);
  const style = { ["--chip" as string]: chipColor(event, today) };
  const second = event.kind === "deadline"
    ? [event.company, event.role].filter(Boolean).join(" · ") || (event.recurrenceDays ? `Every ${event.recurrenceDays} days` : "")
    : event.role;

  const lead = event.kind === "deadline"
    ? <DeadlineTypeIcon type={event.title} size={12} className={`shrink-0 ${lines === 2 ? "mt-[3px]" : ""} ${overdue ? "text-destructive" : "text-foreground/55"}`} />
    : <StageDot stage={event.kind === "stage" ? event.enteredStage : event.stage} className={lines === 2 ? "mt-[6px]" : ""} />;

  const title = event.kind === "deadline" ? (
    <>
      <span className={`font-semibold ${overdue ? "text-destructive" : "text-foreground"}`}>{event.title}</span>
      {lines === 1 && event.company && <span className={`font-normal ${overdue ? "text-destructive/75" : "text-muted-foreground"}`}> · {event.company}</span>}
    </>
  ) : (
    <>
      <span className="font-medium text-foreground/85">{event.company}</span>
      {event.kind === "stage" && <span className="font-normal text-muted-foreground whitespace-nowrap"> → {event.enteredStage}</span>}
    </>
  );

  const button = (
    <button
      type="button"
      data-event-id={event.id}
      aria-label={eventLabel(event, today)}
      onClick={(ev) => handlers.onClick(event, ev.currentTarget)}
      onPointerDown={handlers.onPointerDown ? (ev) => handlers.onPointerDown!(ev, event) : undefined}
      style={style}
      className={`group/chip w-full min-w-0 flex gap-1.5 rounded-md px-1.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-[color-mix(in_oklab,var(--chip)_18%,transparent)] ${
        lines === 2 ? "items-start py-1" : "items-center h-5"
      } ${event.ghost ? "opacity-45 border border-dashed border-foreground/25" : ""}`}
    >
      {lead}
      {lines === 2 ? (
        <span className="min-w-0 flex-1">
          <span className="block line-clamp-2 leading-[1.35]">{title}</span>
          {second && <span className="block truncate text-[11px] text-muted-foreground leading-[1.35]">{second}</span>}
        </span>
      ) : (
        <span className="truncate min-w-0">{title}</span>
      )}
    </button>
  );

  return (
    <HoverCard
      className="flex min-w-0 w-full"
      width={320}
      openDelay={320}
      closeDelay={160}
      disabled={dragging}
      closeOnClick
      ariaLabel={event.kind === "deadline" ? `${event.title} details` : `${event.company} details`}
      content={<EventCard event={event} today={today} app={app} />}
    >
      {button}
    </HoverCard>
  );
});

/* ─── The hover card ─── */

/** Everything worth knowing about an event without leaving the calendar:
 *  for an application, its role, stage, dates, pay, resume, fit, next
 *  deadline and the people you know there. Every row opens the application
 *  (people open their contact). */
export function EventCard({ event, today, app }: { event: CalendarEvent; today: Ymd; app?: CalendarApp }) {
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const { data: resumes = [] } = useResumes();
  const company = useMemo(() => {
    if (!app) return undefined;
    return (app.companyId ? companies.find((c) => c._id === app.companyId) : undefined)
      ?? companies.find((c) => c.name.toLowerCase() === app.company.toLowerCase());
  }, [app, companies]);
  const people = useMemo(() => {
    if (!app) return [];
    const name = app.company.trim().toLowerCase();
    return contacts.filter((c) => (app.companyId && c.companyId === app.companyId) || c.company.trim().toLowerCase() === name);
  }, [app, contacts]);
  const resume = app?.resumeId ? resumes.find((r) => r._id === app.resumeId) : undefined;
  const openApp = app ? `/applications/${app._id}` : null;

  const deadlineBlock = event.kind === "deadline" && (
    <div className="px-2 pt-2 pb-1.5">
      <div className={`flex items-center gap-2 text-[13px] font-semibold ${isOverdue(event, today) ? "text-destructive" : "text-foreground"}`}>
        <DeadlineTypeIcon type={event.title} size={14} />
        {event.title}
      </div>
      <p className={`mt-0.5 text-[12px] ${isOverdue(event, today) ? "text-destructive/80" : "text-muted-foreground"}`}>
        {formatDay(event.date, { weekday: "short", month: "short", day: "numeric" })} · {isOverdue(event, today) ? `${-diffDaysYmd(today, event.date)} days overdue` : relativeDay(event.date, today)}
      </p>
      {!!event.recurrenceDays && (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <Repeat size={12} strokeWidth={1.8} aria-hidden /> Repeats every {event.recurrenceDays} days{event.ghost ? " · upcoming repeat" : ""}
        </p>
      )}
      {event.notes?.trim() && <p className="mt-1.5 text-[12px] text-foreground/80 line-clamp-3 whitespace-pre-line">{event.notes}</p>}
    </div>
  );

  if (!app) return <div className="p-1">{deadlineBlock || <p className="p-2 text-[12px] text-muted-foreground">No details.</p>}</div>;

  const since = app.stageSince ? diffDaysYmd(app.stageSince, today) : null;
  return (
    <div className="p-1.5 text-[12.5px]">
      {deadlineBlock && <>{deadlineBlock}<div className="h-px bg-border mx-2 my-1" /></>}
      <CardLink to={openApp!} className="flex gap-2.5 items-start px-2 py-2">
        <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-foreground truncate">{app.company}</span>
          <span className="block text-muted-foreground truncate">{app.role}</span>
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground/85 bg-[color-mix(in_oklab,var(--stage)_14%,transparent)]" style={{ ["--stage" as string]: STAGE_COLOR[app.stage] }}>
            <StageDot stage={app.stage} />
            {app.stage}{since != null && since >= 0 ? ` · ${since === 0 ? "today" : `${since} day${since === 1 ? "" : "s"}`}` : ""}
          </span>
        </span>
      </CardLink>
      <div className="grid grid-cols-[84px_1fr]">
        {app.applied && app.stage !== "Drafting" && <Field label="Applied" to={openApp!}>{formatDay(app.applied, { weekday: "short", month: "short", day: "numeric" })} · {relativeDay(app.applied, today).toLowerCase()}</Field>}
        {(app.location || app.jobType) && <Field label="Location" to={openApp!}>{[app.location, app.jobType].filter(Boolean).join(" · ")}</Field>}
        {app.salary && <Field label="Salary" to={openApp!}>{app.salary}</Field>}
        {resume && <Field label="Resume" to={openApp!}>{resume.name}</Field>}
        {typeof app.fit?.score === "number" && <Field label="Fit" to={openApp!}>{formatScore(app.fit.score)} / 10</Field>}
      </div>
      {app.nextDeadline && event.kind !== "deadline" && (
        <>
          <div className="h-px bg-border mx-2 my-1" />
          <Label>Next deadline</Label>
          <CardLink to={openApp!} className="flex items-center gap-2 px-2 py-1.5">
            <DeadlineTypeIcon type={app.nextDeadline.type} size={13} className={app.nextDeadline.date < today ? "text-destructive" : "text-foreground/60"} />
            <span className={`font-medium truncate ${app.nextDeadline.date < today ? "text-destructive" : "text-foreground"}`}>{app.nextDeadline.type}</span>
            <span className={`ml-auto shrink-0 text-[12px] ${app.nextDeadline.date < today ? "text-destructive/80" : "text-muted-foreground"}`}>
              {app.nextDeadline.date < today ? `${-diffDaysYmd(today, app.nextDeadline.date)} days overdue` : relativeDay(app.nextDeadline.date, today)}
            </span>
          </CardLink>
        </>
      )}
      {people.length > 0 && (
        <>
          <div className="h-px bg-border mx-2 my-1" />
          <Label>People at {app.company}</Label>
          {people.slice(0, 3).map((p) => (
            <CardLink key={p._id} to={`/contacts?focus=${p._id}`} className="flex items-center gap-2 px-2 py-1.5">
              <span aria-hidden className="w-[22px] h-[22px] rounded-full bg-control grid place-items-center text-[10px] font-semibold text-foreground/80 shrink-0">{initials(p.name)}</span>
              <span className="truncate text-foreground">{p.name}</span>
              {p.role && <span className="ml-auto shrink-0 max-w-[45%] truncate text-[12px] text-muted-foreground">{p.role}</span>}
            </CardLink>
          ))}
          {people.length > 3 && <p className="px-2 pb-1 text-[12px] text-muted-foreground">+{people.length - 3} more</p>}
        </>
      )}
      <div className="h-px bg-border mx-2 mt-1" />
      <CardLink to={openApp!} className="flex items-center justify-between px-2 py-2 mt-0.5 font-medium text-foreground">
        Open application
        <ArrowUpRight size={14} strokeWidth={1.8} className="text-muted-foreground" aria-hidden />
      </CardLink>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function Label({ children }: { children: ReactNode }) {
  return <p className="px-2 pt-1.5 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{children}</p>;
}

function Field({ label, to, children }: { label: string; to: string; children: ReactNode }) {
  return (
    <CardLink to={to} className="col-span-2 grid grid-cols-subgrid px-2 py-[5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground truncate">{children}</span>
    </CardLink>
  );
}

/** A row in the card: a real link (middle-click, ⌘-click open a tab). */
function CardLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  const open = useContext(CalendarOpenContext);
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(to);
      }}
      className={`rounded-lg hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {children}
    </a>
  );
}
