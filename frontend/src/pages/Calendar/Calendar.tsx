/** Comprehensive calendar — 3-column layout, custom toolbar, drag-to-reschedule, quick-add, mark-complete. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { addDays, format, getDay, isToday, parse, startOfDay, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import type { EventInput } from "@fullcalendar/core";
import toast from "react-hot-toast";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { applicationsAPI, deadlinesAPI } from "../../utils/api.ts";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus.ts";
import { buildCalendarEvents, type CalendarExtendedProps, type CalendarFactor } from "../../utils/calendarEvents.ts";
import { eventInputsToRbc, type HireTrailCalendarEvent } from "../../utils/calendarRbc.ts";
import type { Application, Deadline, Stage } from "../../types";
import { STAGES } from "../../utils/stageStyles.ts";

import { EventChip } from "./components/EventChip.tsx";
import { MiniCalendar } from "./components/MiniCalendar.tsx";
import { CalendarToolbar } from "./components/CalendarToolbar.tsx";
import { UpcomingList } from "./components/UpcomingList.tsx";
import { QuickAddDeadlineModal } from "./components/QuickAddDeadlineModal.tsx";
import { EventDetailPanel, type SelectedEvent } from "./components/EventDetailPanel.tsx";
import { FiltersPopover } from "./components/FiltersPopover.tsx";

import "./Calendar.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar) as any;

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

const FACTOR_OPTIONS: { key: CalendarFactor; label: string; swatch: string }[] = [
  { key: "application_submitted", label: "Applications", swatch: "#475569" },
  { key: "stage_change", label: "Stage changes", swatch: "#0ea5e9" },
  { key: "deadline_application", label: "App deadlines", swatch: "#d97706" },
  { key: "deadline_general", label: "Other deadlines", swatch: "#7c3aed" },
];

const defaultFactors = (): Record<CalendarFactor, boolean> =>
  FACTOR_OPTIONS.reduce((acc, o) => { acc[o.key] = true; return acc; }, {} as Record<CalendarFactor, boolean>);

const defaultStageFilter = (): Record<Stage, boolean> =>
  STAGES.reduce((acc, s) => { acc[s] = true; return acc; }, {} as Record<Stage, boolean>);

function rbcEventToSelected(event: HireTrailCalendarEvent): SelectedEvent | null {
  const r = event.resource;
  if (!r || !event.start) return null;
  return {
    title: (event.title as string) ?? "",
    start: event.start as Date,
    factor: r.factor,
    subtitle: r.subtitle,
    route: r.route,
    entityId: r.entityId,
    completed: r.completed,
    applicationId: r.applicationId ?? null,
  };
}

export default function CalendarPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [allDeadlines, setAllDeadlines] = useState<Deadline[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [factors, setFactors] = useState<Record<CalendarFactor, boolean>>(defaultFactors);
  const [companyFilter, setCompanyFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<Record<Stage, boolean>>(defaultStageFilter);
  const [calView, setCalView] = useState<View>("month");
  const [calDate, setCalDate] = useState(new Date());
  const [miniDate, setMiniDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [rightPaneOpen, setRightPaneOpen] = useState(() => {
    try { return localStorage.getItem("hiretrail-cal-right-pane") !== "0"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem("hiretrail-cal-right-pane", rightPaneOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [rightPaneOpen]);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Calendar is a forward-looking surface — only active applications and
      // open deadlines. Archived / terminal-state apps and completed deadlines
      // live in the Applications list and Deadlines page; they don't belong on
      // the calendar.
      const [apps, allDls] = await Promise.all([
        applicationsAPI.getAll({ limit: 1000, archived: "false" }),
        deadlinesAPI.getAllAggregated({ status: "active" }),
      ]);
      const appList = apps.data as Application[];
      setApplications(appList);
      setAllDeadlines(allDls);
      setEvents(buildCalendarEvents({ applications: appList, deadlines: allDls }));
    } catch {
      setError("Could not load calendar data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCalendarData(); }, [loadCalendarData]);
  useRefetchOnFocus(loadCalendarData);

  const companyNames = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) if (app.company?.trim()) set.add(app.company.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const filteredEvents = useMemo(() => events.filter((event) => {
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
  }), [events, factors, companyFilter, stageFilter]);

  const rbcEvents = useMemo(() => eventInputsToRbc(filteredEvents), [filteredEvents]);

  const eventDays = useMemo(() => {
    const s = new Set<string>();
    for (const e of rbcEvents) {
      if (e.start instanceof Date) s.add(e.start.toISOString().slice(0, 10));
    }
    return s;
  }, [rbcEvents]);

  const todayEvents = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return rbcEvents
      .filter((e) => e.start instanceof Date && startOfDay(e.start as Date).getTime() === today)
      .map(rbcEventToSelected)
      .filter((e): e is SelectedEvent => e !== null);
  }, [rbcEvents]);

  const upcomingThisWeek = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const weekEnd = startOfDay(addDays(new Date(), 7)).getTime();
    return rbcEvents
      .filter((e) => {
        if (!(e.start instanceof Date)) return false;
        const t = startOfDay(e.start as Date).getTime();
        return t > today && t <= weekEnd;
      })
      .sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime())
      .map(rbcEventToSelected)
      .filter((e): e is SelectedEvent => e !== null)
      .slice(0, 8);
  }, [rbcEvents]);

  const onSelectEvent = useCallback((event: HireTrailCalendarEvent) => {
    const sel = rbcEventToSelected(event);
    if (sel) setSelectedEvent(sel);
  }, []);

  const draggableAccessor = useCallback((event: HireTrailCalendarEvent) => {
    const f = event.resource?.factor;
    if (f === "deadline_application" || f === "deadline_general") {
      return !event.resource?.completed;
    }
    // Applications can be re-dated. Stage-change events are historical and not draggable.
    if (f === "application_submitted") return true;
    return false;
  }, []);

  const onEventDrop = useCallback(async ({ event, start }: { event: HireTrailCalendarEvent; start: Date; end: Date }) => {
    const r = event.resource;
    const factor = r?.factor;
    const id = r?.entityId;
    if (!id) return;
    const newDate = format(start, "yyyy-MM-dd");

    if (factor === "deadline_application" || factor === "deadline_general") {
      if (r?.completed) {
        toast.error("Completed deadlines can't be moved.");
        // The visual position already shifted in react-big-calendar's local
        // state — force a refetch + clear selection so the chip snaps back
        // to where it actually lives in the DB.
        setSelectedEvent(null);
        await loadCalendarData();
        return;
      }
      try {
        await deadlinesAPI.update(id, { dueDate: newDate });
        toast.success("Deadline rescheduled");
        await loadCalendarData();
      } catch {
        toast.error("Could not update deadline");
        // Same snap-back as above — any failure must restore the calendar to
        // ground truth, otherwise the user sees a date that isn't real.
        setSelectedEvent(null);
        await loadCalendarData();
      }
      return;
    }

    if (factor === "application_submitted") {
      try {
        await applicationsAPI.update(id, { applicationDate: newDate });
        toast.success("Application date updated");
        await loadCalendarData();
      } catch {
        toast.error("Could not update application date");
        setSelectedEvent(null);
        await loadCalendarData();
      }
      return;
    }
  }, [loadCalendarData]);

  const onSelectSlot = useCallback(({ start }: { start: Date }) => {
    setQuickAddDate(start);
  }, []);

  const handleQuickAdd = useCallback(async (data: { type: string; dueDate: string; notes: string; applicationId: string }) => {
    try {
      await deadlinesAPI.create({ type: data.type, dueDate: data.dueDate, notes: data.notes, applicationId: data.applicationId });
      toast.success("Deadline added");
      await loadCalendarData();
    } catch {
      toast.error("Could not create deadline");
    }
  }, [loadCalendarData]);

  const handleMarkComplete = useCallback(async (deadlineId: string) => {
    try {
      await deadlinesAPI.update(deadlineId, { completed: true });
      toast.success("Marked complete");
      setSelectedEvent(null);
      await loadCalendarData();
    } catch {
      toast.error("Could not mark complete");
    }
  }, [loadCalendarData]);

  const handleDelete = useCallback(async (deadlineId: string) => {
    if (!confirm("Delete this deadline?")) return;
    try {
      await deadlinesAPI.delete(deadlineId);
      toast.success("Deadline deleted");
      setSelectedEvent(null);
      await loadCalendarData();
    } catch {
      toast.error("Could not delete deadline");
    }
  }, [loadCalendarData]);

  const handleUpcomingClick = useCallback((d: Deadline) => {
    const date = new Date(d.dueDate);
    setCalDate(date);
    setMiniDate(date);
    const match = rbcEvents.find((e) => e.resource?.entityId === d._id);
    if (match) {
      const sel = rbcEventToSelected(match);
      if (sel) setSelectedEvent(sel);
    }
  }, [rbcEvents]);

  // Keyboard shortcuts: T = today, M/W/D/A = views, ← → = prev/next, Esc = clear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "t": setCalDate(new Date()); break;
        case "m": setCalView("month"); break;
        case "w": setCalView("week"); break;
        case "d": setCalView("day"); break;
        case "a": setCalView("agenda"); break;
      }
      if (e.key === "Escape") setSelectedEvent(null);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const dir: 1 | -1 = e.key === "ArrowRight" ? 1 : -1;
        const next = new Date(calDate);
        if (calView === "month") next.setMonth(next.getMonth() + dir);
        else if (calView === "week") next.setDate(next.getDate() + 7 * dir);
        else if (calView === "day") next.setDate(next.getDate() + dir);
        else next.setDate(next.getDate() + 30 * dir);
        setCalDate(next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [calDate, calView]);

  // Keep mini-cal month in sync when the main calendar changes month
  useEffect(() => { setMiniDate(calDate); }, [calDate]);

  const rbcComponents = useMemo(() => ({ event: EventChip, toolbar: () => null }), []);
  const dayPropGetter = useCallback((date: Date) => (
    isToday(date) ? { className: "rbc-today-emphasis" } : {}
  ), []);

  return (
    <div className="cal-page">
      <header className="cal-page__header">
        <h1 className="cal-page__title">Calendar</h1>
        {location.pathname.startsWith("/admin") && (
          <span className="cal-page__chip">Admin view</span>
        )}
      </header>

      <div className={`cal-shell ${rightPaneOpen ? "" : "cal-shell--no-right"}`}>
        {/* LEFT PANEL */}
        <aside className="cal-side cal-side--left">
          <div className="cal-card cal-card--mini">
            <MiniCalendar
              value={miniDate}
              selected={calDate}
              onSelect={(d) => { setCalDate(d); setCalView("day"); }}
              onMonthChange={setMiniDate}
              eventDays={eventDays}
            />
            <button
              type="button"
              className="cal-new-deadline"
              onClick={() => setQuickAddDate(new Date())}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New deadline
            </button>
          </div>

          <div className="cal-card">
            <h3 className="cal-card__title">Upcoming</h3>
            <UpcomingList deadlines={allDeadlines} onSelect={handleUpcomingClick} />
          </div>
        </aside>

        {/* MAIN CALENDAR */}
        <section className="cal-main">
          <CalendarToolbar
            date={calDate}
            view={calView}
            onNavigate={setCalDate}
            onView={setCalView}
            onRefresh={() => void loadCalendarData()}
            refreshing={loading}
            rightPaneOpen={rightPaneOpen}
            onToggleRightPane={() => setRightPaneOpen((v) => !v)}
            filtersSlot={
              <FiltersPopover
                factors={factors}
                setFactors={setFactors}
                companyFilter={companyFilter}
                setCompanyFilter={setCompanyFilter}
                stageFilter={stageFilter}
                setStageFilter={setStageFilter}
                companyNames={companyNames}
                factorOptions={FACTOR_OPTIONS}
                defaultFactors={defaultFactors()}
                defaultStageFilter={defaultStageFilter()}
                onReset={() => {
                  setFactors(defaultFactors());
                  setStageFilter(defaultStageFilter());
                  setCompanyFilter("");
                }}
              />
            }
          />

          {error && (
            <div className="cal-error">
              {error}
              <button type="button" onClick={() => void loadCalendarData()} className="cal-error__retry">Retry</button>
            </div>
          )}

          <div className="cal-rbc">
            {loading && rbcEvents.length === 0 ? (
              <div className="cal-rbc__loading">Loading calendar…</div>
            ) : (
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
                selectable
                showMultiDayTimes
                draggableAccessor={draggableAccessor}
                onEventDrop={onEventDrop}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                components={rbcComponents}
                dayPropGetter={dayPropGetter}
                messages={{ showMore: (n: number) => `+${n} more` }}
              />
            )}
          </div>
        </section>

        {/* RIGHT PANEL — collapsible */}
        {rightPaneOpen && (
          <aside className="cal-side cal-side--right">
            <EventDetailPanel
              selected={selectedEvent}
              todayEvents={todayEvents}
              upcomingThisWeek={upcomingThisWeek}
              onClearSelection={() => setSelectedEvent(null)}
              onMarkComplete={handleMarkComplete}
              onDelete={handleDelete}
              onSelect={setSelectedEvent}
            />
          </aside>
        )}
      </div>

      {quickAddDate && (
        <QuickAddDeadlineModal
          initialDate={quickAddDate}
          onClose={() => setQuickAddDate(null)}
          onCreate={handleQuickAdd}
        />
      )}
    </div>
  );
}
