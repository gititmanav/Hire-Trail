/**
 * Group deadlines into urgency buckets for the Deadlines page (Phase 3 redesign).
 *
 *   Overdue   — dueDate strictly before today, not completed.
 *   Today     — dueDate falls on today's local date.
 *   Tomorrow  — dueDate is the next calendar day.
 *   This Week — within the next 7 days after tomorrow (i.e. up to today + 7).
 *   Later     — anything dated beyond a week.
 *   Completed — d.completed === true. (Always rendered last when present.)
 *
 * Buckets are stable, in display order. Empty buckets are kept so consumers
 * can render section headers consistently, but most callers will filter to
 * the non-empty ones. */
import type { Deadline } from "../types";

export type DeadlineBucket =
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "completed";

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export const BUCKET_LABEL: Record<DeadlineBucket, string> = {
  overdue:   "Overdue",
  today:     "Today",
  tomorrow:  "Tomorrow",
  thisWeek:  "This Week",
  later:     "Later",
  completed: "Completed",
};

/** Ordered bucket keys — display order matches user expectation: most urgent first. */
export const BUCKET_ORDER: DeadlineBucket[] = ["overdue", "today", "tomorrow", "thisWeek", "later", "completed"];

export function groupDeadlines(deadlines: Deadline[], now: Date = new Date()): Record<DeadlineBucket, Deadline[]> {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS);

  const out: Record<DeadlineBucket, Deadline[]> = {
    overdue:   [],
    today:     [],
    tomorrow:  [],
    thisWeek:  [],
    later:     [],
    completed: [],
  };

  for (const d of deadlines) {
    if (d.completed) {
      out.completed.push(d);
      continue;
    }
    const due = startOfDay(new Date(d.dueDate));
    if (due.getTime() < today.getTime()) {
      out.overdue.push(d);
    } else if (due.getTime() === today.getTime()) {
      out.today.push(d);
    } else if (due.getTime() === tomorrow.getTime()) {
      out.tomorrow.push(d);
    } else if (due.getTime() < weekEnd.getTime()) {
      out.thisWeek.push(d);
    } else {
      out.later.push(d);
    }
  }

  // Within each bucket, sort by due date ascending so closer items surface first.
  for (const k of BUCKET_ORDER) {
    out[k].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  return out;
}
