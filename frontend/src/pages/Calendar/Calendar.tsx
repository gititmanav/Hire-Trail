import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { applicationsAPI, companiesAPI, contactsAPI, deadlinesAPI, resumesAPI } from "../../utils/api.ts";
import { buildCalendarEvents } from "../../utils/calendarEvents.ts";
import type { Application, Company, Contact, Deadline, Resume } from "../../types";
import "./Calendar.css";

const MODULE_FILTERS = [
  { key: "all", label: "All modules" },
  { key: "applications", label: "Applications" },
  { key: "deadlines", label: "Deadlines" },
  { key: "contacts", label: "Contacts" },
  { key: "resumes", label: "Resumes" },
  { key: "companies", label: "Companies" },
] as const;

type ModuleFilter = (typeof MODULE_FILTERS)[number]["key"];
const FullCalendarView = FullCalendar as any;

export default function CalendarPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [events, setEvents] = useState<EventInput[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [apps, deadlines, contacts, resumes, companies] = await Promise.all([
          applicationsAPI.getAll({ limit: 1000, archived: "all" }),
          deadlinesAPI.getAll({ limit: 1000, status: "all" }),
          contactsAPI.getAll({ limit: 1000 }),
          resumesAPI.getAll(),
          companiesAPI.getAll({ limit: 1000 }),
        ]);
        setEvents(
          buildCalendarEvents({
            applications: apps.data as Application[],
            deadlines: deadlines.data as Deadline[],
            contacts: contacts.data as Contact[],
            resumes: resumes as Resume[],
            companies: companies.data as Company[],
          })
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredEvents = useMemo(() => {
    if (moduleFilter === "all") return events;
    return events.filter((event) => event.extendedProps?.source === moduleFilter);
  }, [events, moduleFilter]);

  const onEventClick = (arg: EventClickArg) => {
    const route = (arg.event.extendedProps?.route as string | undefined) || "/applications";
    navigate(route);
  };

  return (
    <div className="fade-up calendar-page space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unified timeline for applications, deadlines, contacts, resumes, and companies.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {MODULE_FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setModuleFilter(item.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                moduleFilter === item.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-premium p-3 md:p-4">
        {loading ? (
          <div className="h-[620px] flex items-center justify-center text-sm text-muted-foreground">Loading calendar...</div>
        ) : (
          <FullCalendarView
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,listWeek",
            }}
            buttonText={{
              today: "Today",
              month: "Month",
              week: "Week",
              list: "List",
            }}
            height={620}
            events={filteredEvents}
            editable={false}
            eventClick={onEventClick}
            dayMaxEvents
          />
        )}
      </div>
    </div>
  );
}
