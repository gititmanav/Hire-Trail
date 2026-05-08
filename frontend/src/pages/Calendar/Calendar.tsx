import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import type { EventProps } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import type { EventInput } from "@fullcalendar/core";
import toast from "react-hot-toast";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { applicationsAPI, deadlinesAPI } from "../../utils/api.ts";
import { buildCalendarEvents, type CalendarExtendedProps, type CalendarFactor } from "../../utils/calendarEvents.ts";
import { eventInputsToRbc, type HireTrailCalendarEvent } from "../../utils/calendarRbc.ts";
import type { Application, Stage } from "../../types";
import { STAGES } from "../../utils/stageStyles.ts";
import "./Calendar.css";

/** Drag-and-drop addon adds props not declared on CalendarProps in @types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar) as any;

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const FACTOR_OPTIONS: { key: CalendarFactor; label: string; description: string }[] = [
  { key: "application_submitted", label: "Application submitted", description: "Date you applied" },
  { key: "stage_change", label: "Stage changes", description: "When a role moved to a new stage" },
  { key: "deadline_application", label: "Deadlines (applications)", description: "Due dates tied to a role" },
  { key: "deadline_general", label: "Deadlines (other)", description: "Standalone due dates" },
];

const FACTOR_LABELS: Record<CalendarFactor, string> = {
  application_submitted: "Application submitted",
  stage_change: "Stage change",
  deadline_application: "Deadline (application)",
  deadline_general: "Deadline (other)",
};

const defaultStageFilter = (): Record<Stage, boolean> =>
  STAGES.reduce((acc, s) => {
    acc[s] = true;
    return acc;
  }, {} as Record<Stage, boolean>);

const defaultFactors = (): Record<CalendarFactor, boolean> =>
  FACTOR_OPTIONS.reduce((acc, o) => {
    acc[o.key] = true;
    return acc;
  }, {} as Record<CalendarFactor, boolean>);

function HireTrailEvent({ event }: EventProps<HireTrailCalendarEvent>) {
  const bg = event.resource?.backgroundColor ?? "#64748b";
  const border = event.resource?.borderColor ?? "#475569";
  const label = typeof event.title === "string" ? event.title : "";
  return (
    <div
      className="hiretrail-rbc-event-inner"
      style={{ backgroundColor: bg, borderLeft: `3px solid ${border}` }}
      title={label}
    >
      <span className="hiretrail-rbc-event-title">{event.title}</span>
    </div>
  );
}

interface CalendarEventDetails {
  title: string;
  start: string;
  factor: CalendarFactor;
  subtitle?: string;
  route: string;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetails | null>(null);
  const [factors, setFactors] = useState<Record<CalendarFactor, boolean>>(defaultFactors);
  const [companyFilter, setCompanyFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<Record<Stage, boolean>>(defaultStageFilter);
  const [calView, setCalView] = useState<View>("month");
  const [calDate, setCalDate] = useState(new Date());

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [apps, allDeadlines] = await Promise.all([
        applicationsAPI.getAll({ limit: 1000, archived: "all" }),
        deadlinesAPI.getAllAggregated({ status: "all" }),
      ]);
      const appList = apps.data as Application[];
      setApplications(appList);
      setEvents(
        buildCalendarEvents({
          applications: appList,
          deadlines: allDeadlines,
        })
      );
    } catch {
      setError("Could not load calendar data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const companyNames = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      if (app.company?.trim()) set.add(app.company.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const p = event.extendedProps as CalendarExtendedProps | undefined;
      if (!p?.factor) return false;
      if (!factors[p.factor]) return false;

      if (companyFilter) {
        if (p.factor === "deadline_general") return false;
        if (p.company !== companyFilter) return false;
      }

      if (p.factor === "application_submitted" || p.factor === "stage_change") {
        if (p.applicationStage == null) return true;
        return stageFilter[p.applicationStage];
      }

      return true;
    });
  }, [events, factors, companyFilter, stageFilter]);

  const rbcEvents = useMemo(() => eventInputsToRbc(filteredEvents), [filteredEvents]);

  const toggleFactor = (key: CalendarFactor) => {
    setFactors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStage = (stage: Stage) => {
    setStageFilter((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const onSelectEvent = useCallback((event: HireTrailCalendarEvent) => {
    const p = event.resource;
    const route = p?.route || "/applications";
    const factor = (p?.factor as CalendarFactor) || "application_submitted";
    const subtitle = p?.subtitle;
    const start = event.start ? format(event.start as Date, "PP") : "";

    setSelectedEvent({
      title: (event.title as string) || "",
      start,
      factor,
      subtitle,
      route,
    });
  }, []);

  const draggableAccessor = useCallback((event: HireTrailCalendarEvent) => {
    const f = event.resource?.factor;
    if (f !== "deadline_application" && f !== "deadline_general") return false;
    return !event.resource?.completed;
  }, []);

  const onEventDrop = useCallback(
    async ({ event, start }: { event: HireTrailCalendarEvent; start: Date; end: Date }) => {
      const r = event.resource;
      const factor = r?.factor;
      if (factor !== "deadline_application" && factor !== "deadline_general") return;
      if (r?.completed) {
        toast.error("Completed deadlines can't be moved.");
        return;
      }
      const id = r?.entityId;
      if (!id) return;
      const dueDate = format(start, "yyyy-MM-dd");
      try {
        await deadlinesAPI.update(id, { dueDate });
        toast.success("Deadline updated");
        await loadCalendarData();
      } catch {
        toast.error("Could not update deadline");
      }
    },
    [loadCalendarData]
  );

  const rbcComponents = useMemo(() => ({ event: HireTrailEvent }), []);

  return (
    <div className="fade-up calendar-page space-y-5">
      <section className="calendar-hero card-premium">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-foreground tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Month, week, day, and agenda views. Drag a <strong className="text-foreground font-semibold">deadline</strong>{" "}
            to another day to reschedule it (saved to your account). Application milestones stay read-only here—change
            those from Applications / Kanban. UI patterns follow{" "}
            <a
              href="https://github.com/list-jonas/shadcn-ui-big-calendar"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              shadcn-ui-big-calendar
            </a>
            -style scheduling.
          </p>
        </div>
        <div className="calendar-hero-actions">
          <button type="button" onClick={() => void loadCalendarData()} className="calendar-refresh-btn" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {location.pathname.startsWith("/admin") && (
            <span className="calendar-admin-chip" title="Admin route">
              Admin View
            </span>
          )}
        </div>
      </section>

      <section className="calendar-toolbar card-premium">
        <p className="calendar-toolbar-heading">Show on calendar</p>
        <div className="calendar-factor-grid">
          {FACTOR_OPTIONS.map((opt) => (
            <label key={opt.key} className="calendar-factor-label">
              <input
                type="checkbox"
                className="calendar-checkbox"
                checked={factors[opt.key]}
                onChange={() => toggleFactor(opt.key)}
              />
              <span className="calendar-factor-text">
                <span className="calendar-factor-title">{opt.label}</span>
                <span className="calendar-factor-desc">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="calendar-toolbar-divider" />

        <p className="calendar-toolbar-heading">Narrow by pipeline</p>
        <p className="text-xs text-muted-foreground mb-2">
          Stage filters apply to application events only; deadlines stay visible when their checkboxes are on.
        </p>
        <div className="calendar-pipeline-row">
          <label className="calendar-field">
            <span className="calendar-field-label">Company</span>
            <select className="calendar-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">All companies</option>
              {companyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="calendar-stage-field">
            <span className="calendar-field-label">Application stage</span>
            <div className="calendar-stage-chips">
              {STAGES.map((stage) => (
                <label key={stage} className="calendar-stage-chip">
                  <input
                    type="checkbox"
                    className="calendar-checkbox"
                    checked={stageFilter[stage]}
                    onChange={() => toggleStage(stage)}
                  />
                  <span>{stage}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="calendar-grid">
        <div className="card-premium p-3 md:p-4 hiretrail-rbc-card">
          {error && (
            <div className="calendar-error-banner">
              {error}
              <button type="button" onClick={() => void loadCalendarData()} className="calendar-error-retry-btn">
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="h-[640px] flex items-center justify-center text-sm text-muted-foreground">Loading calendar...</div>
          ) : (
            <div className="hiretrail-rbc-shell">
              <DnDCalendar
                style={{ height: "100%" }}
                localizer={localizer}
                culture="en-US"
                events={rbcEvents}
                view={calView}
                views={["month", "week", "day", "agenda"]}
                date={calDate}
                onNavigate={setCalDate}
                onView={setCalView}
                startAccessor="start"
                endAccessor="end"
                popup
                showMultiDayTimes
                draggableAccessor={draggableAccessor}
                onEventDrop={onEventDrop}
                onSelectEvent={onSelectEvent}
                components={rbcComponents}
                messages={{
                  today: "Today",
                  next: "Next",
                  previous: "Back",
                  month: "Month",
                  week: "Week",
                  day: "Day",
                  agenda: "Agenda",
                  showMore: (n: number) => `+${n} more`,
                }}
              />
            </div>
          )}
        </div>

        <aside className="calendar-side-panel card-premium">
          <h2 className="calendar-side-title">Event details</h2>
          {selectedEvent ? (
            <div className="calendar-side-body">
              <p className="calendar-side-event-title">{selectedEvent.title}</p>
              <p className="calendar-side-subtle">{selectedEvent.subtitle || "—"}</p>
              <div className="calendar-side-meta">
                <span>{selectedEvent.start || "No date"}</span>
                <span className="calendar-side-tag">{FACTOR_LABELS[selectedEvent.factor]}</span>
              </div>
              <button type="button" onClick={() => navigate(selectedEvent.route)} className="calendar-open-btn">
                Open module
              </button>
            </div>
          ) : (
            <p className="calendar-side-empty">Select an event to see details and open the related module.</p>
          )}
        </aside>
      </section>
    </div>
  );
}
