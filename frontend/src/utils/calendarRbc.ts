import type { EventInput } from "@fullcalendar/core";
import type { Event as RBCEvent } from "react-big-calendar";
import { addDays, parseISO } from "date-fns";
import type { CalendarExtendedProps } from "./calendarEvents.ts";

export type HireTrailCalendarEvent = RBCEvent & {
  id?: string;
  resource?: CalendarExtendedProps & {
    backgroundColor?: string;
    borderColor?: string;
  };
};

/** Map pipeline events to react-big-calendar (all-day, exclusive end). */
export function eventInputsToRbc(inputs: EventInput[]): HireTrailCalendarEvent[] {
  return inputs.map((e) => {
    const raw = e.start;
    const day =
      typeof raw === "string" ? raw.slice(0, 10) : raw instanceof Date ? raw.toISOString().slice(0, 10) : "";
    const start = parseISO(day || "1970-01-01");
    const end = addDays(start, 1);
    return {
      id: e.id as string | undefined,
      title: (e.title as string) ?? "",
      start,
      end,
      allDay: true,
      resource: {
        ...(e.extendedProps as CalendarExtendedProps),
        backgroundColor: e.backgroundColor as string | undefined,
        borderColor: e.borderColor as string | undefined,
      },
    };
  });
}
