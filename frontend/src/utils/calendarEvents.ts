import type { EventInput } from "@fullcalendar/core";
import type { Application, Deadline, Stage } from "../types";
import { STAGE_CALENDAR_HEX } from "./stageStyles.ts";

export type CalendarFactor =
  | "application_submitted"
  | "stage_change"
  | "deadline_application"
  | "deadline_general";

export interface CalendarExtendedProps {
  factor: CalendarFactor;
  route: string;
  entityId: string;
  /** Deadlines only — used to disable drag when already completed. */
  completed?: boolean;
  subtitle?: string;
  /** Company name on the application (for filtering). */
  company: string;
  /** Current pipeline stage of the parent application (for stage filter). */
  applicationStage: Stage | null;
  /** For stage-change events, the stage entered on this date. */
  enteredStage?: Stage;
  applicationId?: string | null;
}

interface BuildCalendarEventsParams {
  applications: Application[];
  deadlines: Deadline[];
}

const isoDay = (value: string) => value.slice(0, 10);

/** Normalize Mongo/API ids for Map lookup. */
function idKey(id: unknown): string {
  if (id == null || id === "") return "";
  if (typeof id === "string") return id;
  if (typeof id === "object" && id !== null && "_id" in id) {
    return String((id as { _id: string })._id);
  }
  return String(id);
}

function dueDateToIsoDay(dueDate: string | Date | undefined | null): string {
  if (dueDate == null) return "";
  if (typeof dueDate === "string") return dueDate.slice(0, 10);
  if (dueDate instanceof Date) return dueDate.toISOString().slice(0, 10);
  return String(dueDate).slice(0, 10);
}

const SUBMITTED_CHIP = { backgroundColor: "#475569", borderColor: "#334155" };

function deadlineChipColors(d: Deadline): { backgroundColor: string; borderColor: string } {
  if (d.completed) {
    return { backgroundColor: "#059669", borderColor: "#047857" };
  }
  const day = dueDateToIsoDay(d.dueDate);
  if (!day) return { backgroundColor: "#64748b", borderColor: "#475569" };
  const due = new Date(day + "T12:00:00");
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) {
    return { backgroundColor: "#dc2626", borderColor: "#991b1b" };
  }
  if (due.getTime() === today.getTime()) {
    return { backgroundColor: "#7c3aed", borderColor: "#6d28d9" };
  }
  return { backgroundColor: "#d97706", borderColor: "#b45309" };
}

/** Pick the history entry that represents the application's CURRENT stage —
 *  i.e. the most recent entry whose `stage` matches the app's live `stage` field.
 *  Older transitions (Applied → OA → Applied → OA toggles, or earlier stages we've
 *  already moved past) aren't surfaced; they're noise on a calendar view. */
function currentStageEntry(app: Application): { stage: Stage; date: string } | null {
  if (!app.stageHistory || app.stageHistory.length === 0) return null;
  // Walk from newest to oldest. stageHistory is appended in order, so the last
  // element with the matching stage is the most recent transition INTO that stage.
  for (let i = app.stageHistory.length - 1; i >= 0; i--) {
    const entry = app.stageHistory[i];
    if (entry.stage === app.stage) return entry;
  }
  // Fallback: no entry matches the live stage (data drift). Use the most recent one.
  return app.stageHistory[app.stageHistory.length - 1];
}

/** The calendar surface is forward-looking: drop apps that are archived or in
 *  a terminal stage (Offer / Rejected), and drop deadlines that are already
 *  completed. These items live elsewhere in the product — putting them here
 *  just clutters the day grid. */
function isCalendarRelevantApp(app: Application): boolean {
  if (app.archived) return false;
  if (app.stage === "Offer" || app.stage === "Rejected") return false;
  return true;
}

function isCalendarRelevantDeadline(d: Deadline): boolean {
  return !d.completed;
}

export function buildCalendarEvents({ applications, deadlines }: BuildCalendarEventsParams): EventInput[] {
  const events: EventInput[] = [];
  const relevantApps = applications.filter(isCalendarRelevantApp);
  const relevantDeadlines = deadlines.filter(isCalendarRelevantDeadline);
  const appById = new Map(relevantApps.map((a) => [idKey(a._id), a]));

  for (const app of relevantApps) {
    events.push({
      id: `app-submitted-${app._id}`,
      title: `Applied · ${app.company} — ${app.role}`,
      start: isoDay(app.applicationDate),
      allDay: true,
      backgroundColor: SUBMITTED_CHIP.backgroundColor,
      borderColor: SUBMITTED_CHIP.borderColor,
      extendedProps: {
        factor: "application_submitted",
        route: "/applications",
        entityId: app._id,
        subtitle: `Submitted`,
        company: app.company,
        applicationStage: app.stage,
        applicationId: app._id,
      } satisfies CalendarExtendedProps,
    });

    // Only the CURRENT stage gets a chip — and only if it's a real transition past Applied.
    // (The Applied submission already has its own chip above; emitting another Applied chip
    // for an unchanged app would just duplicate the dot on the same day.)
    const current = currentStageEntry(app);
    if (current && current.stage !== "Applied") {
      const { backgroundColor, borderColor } = STAGE_CALENDAR_HEX[current.stage];
      events.push({
        id: `app-stage-${app._id}-${current.stage}-${isoDay(current.date)}`,
        title: `${current.stage} · ${app.company}`,
        start: isoDay(current.date),
        allDay: true,
        backgroundColor,
        borderColor,
        extendedProps: {
          factor: "stage_change",
          route: "/applications",
          entityId: app._id,
          subtitle: app.role,
          company: app.company,
          applicationStage: app.stage,
          enteredStage: current.stage,
          applicationId: app._id,
        } satisfies CalendarExtendedProps,
      });
    }
  }

  for (const deadline of relevantDeadlines) {
    const day = dueDateToIsoDay(deadline.dueDate);
    if (!day) continue;
    const { backgroundColor, borderColor } = deadlineChipColors(deadline);
    const aid = idKey(deadline.applicationId);
    const linkedApp = aid ? appById.get(aid) : undefined;
    const factor: CalendarFactor = linkedApp ? "deadline_application" : "deadline_general";
    const title = linkedApp
      ? `${deadline.type} · ${linkedApp.company}`
      : deadline.type;
    const subtitle = linkedApp
      ? linkedApp.role
      : deadline.completed
        ? "Completed"
        : "Deadline";

    events.push({
      id: `deadline-${deadline._id}`,
      title,
      start: day,
      allDay: true,
      backgroundColor,
      borderColor,
      extendedProps: {
        factor,
        route: "/deadlines",
        entityId: deadline._id,
        completed: deadline.completed,
        subtitle,
        company: linkedApp?.company ?? "",
        applicationStage: linkedApp ? linkedApp.stage : null,
        applicationId: deadline.applicationId,
      } satisfies CalendarExtendedProps,
    });
  }

  return events;
}
