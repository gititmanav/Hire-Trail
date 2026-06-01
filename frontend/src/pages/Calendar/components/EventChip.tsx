/** Outlook-style event chip: left color bar + factor icon + title. */
import type { EventProps } from "react-big-calendar";
import { Check, Send, Repeat, Clock } from "lucide-react";
import type { CalendarFactor } from "../../../utils/calendarEvents.ts";
import type { HireTrailCalendarEvent } from "../../../utils/calendarRbc.ts";

function FactorIcon({ factor, completed }: { factor?: CalendarFactor; completed?: boolean }) {
  if (completed) return <Check size={11} strokeWidth={2.5} aria-hidden />;
  switch (factor) {
    case "application_submitted": return <Send size={11} strokeWidth={2} aria-hidden />;
    case "stage_change":          return <Repeat size={11} strokeWidth={2} aria-hidden />;
    case "deadline_application":
    case "deadline_general":      return <Clock size={11} strokeWidth={2} aria-hidden />;
    default: return null;
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
