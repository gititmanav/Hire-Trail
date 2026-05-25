/**
 * Pure functions that score the "health" of an application and suggest the next
 * action. Used by the Applications row and Kanban card to render a color-coded
 * age badge and a stage-aware CTA.
 *
 * Health is intentionally measured against the **last stage change**, not the
 * application creation date — a job applied 90 days ago that just moved to
 * Interview last week is healthy, not stale.
 */
import type { Application, Contact, Deadline, Stage } from "../types";

export type HealthTone = "fresh" | "warm" | "cooling" | "stale" | "neutral";

export interface AppHealth {
  tone: HealthTone;
  /** Whole-number days, ≥ 0. */
  daysSinceStageChange: number;
  /** Short display label, e.g. "3d", "2w", "45d", "—". */
  shortLabel: string;
  /** Long descriptive label for tooltip / aria, e.g. "23 days in Applied". */
  longLabel: string;
}

export type NextActionKind =
  | "open"
  | "tailor"
  | "followup"
  | "prep"
  | "decide"
  | "note";

export interface NextAction {
  /** Short button label, e.g. "Open in Tailor", "Add follow-up". */
  label: string;
  kind: NextActionKind;
  /** Optional sub-line surfaced near the CTA. */
  hint?: string;
  /** When true, the row should also surface this as a soft-signal chip. */
  urgent?: boolean;
}

const DAY_MS = 86_400_000;

const startOfDay = (d: Date): Date => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};

/** Returns the most recent stage-change date, falling back to applicationDate. */
export function lastStageChangeDate(app: Application): Date {
  if (Array.isArray(app.stageHistory) && app.stageHistory.length > 0) {
    const last = app.stageHistory[app.stageHistory.length - 1];
    if (last?.date) return new Date(last.date);
  }
  return new Date(app.applicationDate);
}

export function daysSinceLastStageChange(app: Application, now: Date = new Date()): number {
  const last = startOfDay(lastStageChangeDate(app)).getTime();
  const today = startOfDay(now).getTime();
  return Math.max(0, Math.round((today - last) / DAY_MS));
}

/** Stages where age coloring should be neutral (no urgency implied). */
const TERMINAL_STAGES: ReadonlySet<Stage> = new Set<Stage>(["Offer", "Rejected"]);

function toneFromDays(days: number, stage: Stage): HealthTone {
  if (TERMINAL_STAGES.has(stage)) return "neutral";
  if (days <= 7) return "fresh";
  if (days <= 21) return "warm";
  if (days <= 45) return "cooling";
  return "stale";
}

function formatShortAge(days: number): string {
  if (days <= 0) return "today";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function computeAppHealth(app: Application, now: Date = new Date()): AppHealth {
  const days = daysSinceLastStageChange(app, now);
  const tone = toneFromDays(days, app.stage);
  return {
    tone,
    daysSinceStageChange: days,
    shortLabel: formatShortAge(days),
    longLabel: `${days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`} in ${app.stage}`,
  };
}

/* ───── Tailwind class mappings (kept here so consumers don't duplicate) ───── */

export const HEALTH_DOT_CLASS: Record<HealthTone, string> = {
  fresh: "bg-emerald-500",
  warm: "bg-amber-500",
  cooling: "bg-orange-500",
  stale: "bg-red-500",
  neutral: "bg-slate-400",
};

export const HEALTH_BADGE_CLASS: Record<HealthTone, string> = {
  fresh: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50",
  warm: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50",
  cooling: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800/50",
  stale: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/50",
  neutral: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700/60",
};

/* ───── Next-action rules ───── */

interface NextActionContext {
  deadlines?: Deadline[];
  contact?: Contact | null;
  now?: Date;
}

/**
 * Picks the most useful next action for the user given an application's stage
 * and surrounding context. The CTA frame is uniform — only the label varies.
 */
export function suggestNextAction(app: Application, ctx: NextActionContext = {}): NextAction {
  const now = ctx.now ?? new Date();
  const days = daysSinceLastStageChange(app, now);
  const upcomingDeadlines = (ctx.deadlines ?? [])
    .filter((d) => d.applicationId === app._id && !d.completed)
    .map((d) => ({ ...d, due: new Date(d.dueDate) }))
    .filter((d) => !isNaN(d.due.getTime()))
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  switch (app.stage) {
    case "Drafting": {
      if (app.tailorSessionId) {
        return { label: "Open in Tailor", kind: "tailor", hint: "Resume draft in progress" };
      }
      return { label: "Open details", kind: "open", hint: "Pre-submission" };
    }
    case "Applied": {
      if (days >= 10 && !ctx.contact) {
        return {
          label: "Add a follow-up",
          kind: "followup",
          hint: `${days}d, no contact linked`,
          urgent: days >= 21,
        };
      }
      if (days >= 14) {
        return {
          label: "Send a nudge",
          kind: "followup",
          hint: `${days}d since applied`,
          urgent: days >= 30,
        };
      }
      return { label: "Open details", kind: "open", hint: "Awaiting response" };
    }
    case "OA": {
      const next = upcomingDeadlines[0];
      if (next) {
        const dueIn = Math.round((startOfDay(next.due).getTime() - startOfDay(now).getTime()) / DAY_MS);
        return {
          label: dueIn <= 0 ? "OA due today" : `OA in ${dueIn}d`,
          kind: "prep",
          hint: next.type,
          urgent: dueIn <= 2,
        };
      }
      return { label: "Add OA deadline", kind: "prep", hint: "No date saved" };
    }
    case "Interview": {
      const next = upcomingDeadlines[0];
      if (next) {
        const dueIn = Math.round((startOfDay(next.due).getTime() - startOfDay(now).getTime()) / DAY_MS);
        return {
          label: dueIn <= 0 ? "Interview today" : `Interview in ${dueIn}d`,
          kind: "prep",
          hint: next.type,
          urgent: dueIn <= 2,
        };
      }
      if (days >= 14) {
        return { label: "Send a nudge", kind: "followup", hint: `${days}d, no update`, urgent: days >= 30 };
      }
      return { label: "Add prep deadline", kind: "prep", hint: "Schedule prep time" };
    }
    case "Offer": {
      const next = upcomingDeadlines[0];
      if (next) {
        const dueIn = Math.round((startOfDay(next.due).getTime() - startOfDay(now).getTime()) / DAY_MS);
        return {
          label: dueIn <= 0 ? "Decide today" : `Decide in ${dueIn}d`,
          kind: "decide",
          hint: next.type,
          urgent: dueIn <= 3,
        };
      }
      return { label: "Set decision date", kind: "decide", hint: "Don't let it expire" };
    }
    case "Rejected": {
      return { label: "Add a takeaway", kind: "note", hint: "Capture what to do differently" };
    }
    default:
      return { label: "Open details", kind: "open" };
  }
}
