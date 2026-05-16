/** Right-side panel: selected event details + actions, or "today" agenda when nothing selected. */
import { format, isPast, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { CalendarFactor } from "../../../utils/calendarEvents.ts";
import type { Deadline } from "../../../types";

const FACTOR_LABELS: Record<CalendarFactor, string> = {
  application_submitted: "Application submitted",
  stage_change: "Stage change",
  deadline_application: "Deadline (application)",
  deadline_general: "Deadline (other)",
};

export interface SelectedEvent {
  title: string;
  start: Date;
  factor: CalendarFactor;
  subtitle?: string;
  route: string;
  entityId: string;
  completed?: boolean;
  applicationId?: string | null;
}

interface Props {
  selected: SelectedEvent | null;
  todayEvents: SelectedEvent[];
  upcomingThisWeek: SelectedEvent[];
  onClearSelection: () => void;
  onMarkComplete: (deadlineId: string) => Promise<void>;
  onDelete: (deadlineId: string) => Promise<void>;
  onSelect: (e: SelectedEvent) => void;
}

function FactorBadge({ factor, completed }: { factor: CalendarFactor; completed?: boolean }) {
  return (
    <span className={`event-detail__badge event-detail__badge--${factor.replace("_", "-")} ${completed ? "event-detail__badge--done" : ""}`}>
      {completed ? "Completed" : FACTOR_LABELS[factor]}
    </span>
  );
}

function AgendaItem({ event, onSelect }: { event: SelectedEvent; onSelect: (e: SelectedEvent) => void }) {
  const overdue = isPast(event.start) && !isToday(event.start) && !event.completed && (event.factor === "deadline_application" || event.factor === "deadline_general");
  return (
    <button type="button" className={`agenda__item ${overdue ? "agenda__item--overdue" : ""}`} onClick={() => onSelect(event)}>
      <span className={`agenda__dot agenda__dot--${event.factor.replace("_", "-")}`} />
      <span className="agenda__body">
        <span className="agenda__title">{event.title}</span>
        <span className="agenda__meta">
          {format(event.start, "EEE, MMM d")} · {FACTOR_LABELS[event.factor]}
          {event.completed ? " · done" : ""}
        </span>
      </span>
    </button>
  );
}

export function EventDetailPanel({ selected, todayEvents, upcomingThisWeek, onClearSelection, onMarkComplete, onDelete, onSelect }: Props) {
  const navigate = useNavigate();

  if (selected) {
    const isDeadline = selected.factor === "deadline_application" || selected.factor === "deadline_general";
    return (
      <div className="cal-card event-detail">
        <div className="event-detail__head">
          <FactorBadge factor={selected.factor} completed={selected.completed} />
          <button type="button" className="event-detail__back" onClick={onClearSelection} title="Back to today's agenda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>
        <h3 className="event-detail__title">{selected.title}</h3>
        {selected.subtitle && <p className="event-detail__subtitle">{selected.subtitle}</p>}
        <div className="event-detail__when">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>{format(selected.start, "EEEE, MMMM d, yyyy")}</span>
        </div>

        <div className="event-detail__actions">
          <button type="button" className="event-detail__btn event-detail__btn--primary" onClick={() => navigate(selected.route)}>
            Open in {selected.factor.startsWith("deadline") ? "Deadlines" : "Applications"}
          </button>
          {isDeadline && !selected.completed && (
            <button type="button" className="event-detail__btn" onClick={() => onMarkComplete(selected.entityId)}>
              Mark complete
            </button>
          )}
          {isDeadline && (
            <button type="button" className="event-detail__btn event-detail__btn--danger" onClick={() => onDelete(selected.entityId)}>
              Delete
            </button>
          )}
        </div>

        <p className="event-detail__hint">
          {isDeadline
            ? "Tip: drag this event to another day on the calendar to reschedule."
            : "Application milestones are read-only here — change them from Applications or Kanban."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="cal-card">
        <div className="event-detail__agenda-head">
          <h3 className="cal-card__title">Today</h3>
          <span className="event-detail__date">{format(new Date(), "EEE, MMM d")}</span>
        </div>
        {todayEvents.length === 0 ? (
          <p className="event-detail__empty">Nothing scheduled for today. Click any empty day to add a deadline.</p>
        ) : (
          <div className="agenda">
            {todayEvents.map((e) => (
              <AgendaItem key={`${e.entityId}-${e.factor}-${e.start.toISOString()}`} event={e} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>

      {upcomingThisWeek.length > 0 && (
        <div className="cal-card">
          <h3 className="cal-card__title">Next 7 days</h3>
          <div className="agenda">
            {upcomingThisWeek.map((e) => (
              <AgendaItem key={`u-${e.entityId}-${e.factor}-${e.start.toISOString()}`} event={e} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export { FACTOR_LABELS };
