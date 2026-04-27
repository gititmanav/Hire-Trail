import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import "./MiniCalendarWidget.css";

interface Props {
  events: EventInput[];
}
const FullCalendarView = FullCalendar as any;

export default function MiniCalendarWidget({ events }: Props) {
  const navigate = useNavigate();

  const topEvents = useMemo(() => events.slice(0, 80), [events]);

  const onEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    navigate(((arg.event.extendedProps?.route as string | undefined) || "/calendar"));
  };

  return (
    <div className="h-full flex flex-col mini-calendar-widget">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Calendar snapshot</span>
        <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Open full
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <FullCalendarView
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="100%"
          headerToolbar={false}
          dayMaxEvents={1}
          fixedWeekCount={false}
          events={topEvents}
          eventClick={onEventClick}
        />
      </div>
    </div>
  );
}
