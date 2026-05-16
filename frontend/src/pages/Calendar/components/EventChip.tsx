/** Outlook-style event chip: left color bar + factor icon + title. */
import type { EventProps } from "react-big-calendar";
import type { CalendarFactor } from "../../../utils/calendarEvents.ts";
import type { HireTrailCalendarEvent } from "../../../utils/calendarRbc.ts";

function FactorIcon({ factor, completed }: { factor?: CalendarFactor; completed?: boolean }) {
  if (completed) {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  switch (factor) {
    case "application_submitted":
      return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case "stage_change":
      return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "deadline_application":
    case "deadline_general":
      return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    default:
      return null;
  }
}

export function EventChip({ event }: EventProps<HireTrailCalendarEvent>) {
  const bg = event.resource?.backgroundColor ?? "#64748b";
  const border = event.resource?.borderColor ?? "#475569";
  const factor = event.resource?.factor;
  const completed = event.resource?.completed;
  const label = typeof event.title === "string" ? event.title : "";

  return (
    <div
      className={`ht-event-chip ${completed ? "ht-event-chip--done" : ""}`}
      style={{ ["--chip-bg" as string]: bg, ["--chip-border" as string]: border }}
      title={label}
    >
      <span className="ht-event-chip__icon" aria-hidden="true">
        <FactorIcon factor={factor} completed={completed} />
      </span>
      <span className="ht-event-chip__title">{label}</span>
    </div>
  );
}
