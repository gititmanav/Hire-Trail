/**
 * Pure layout engine for the calendar — days in, positioned days out. No DOM,
 * no React, so the rules that decide what a job seeker sees first are unit
 * tested on their own (`calendarGrid.test.ts`).
 *
 * Every HireTrail event is a single day (deadlines, applied dates, stage
 * entries), so there are no spans: a day is an ordered list, and the month
 * grid is 6 × 7 of those lists.
 */
import { addDaysYmd, diffDaysYmd, formatYmd, monthOf, weekStartOf, type Ymd } from "./dates.ts";
import type { Stage } from "../types";

export type EventKind = "deadline" | "applied" | "stage";

export interface CalendarEvent {
  /** Unique per event — "deadline:<id>", "applied:<appId>", "stage:<appId>", "ghost:<id>:<day>". */
  id: string;
  kind: EventKind;
  date: Ymd;
  /** The document an edit goes to: the deadline, or the application. */
  entityId: string;
  applicationId: string | null;
  /** Deadline type for deadlines; the company for records. */
  title: string;
  company: string;
  role: string;
  /** The application's current stage — the colour of a record's dot. */
  stage?: Stage;
  /** Stage events: the stage entered on this day. */
  enteredStage?: Stage;
  notes?: string;
  recurrenceDays?: number;
  /** A projected repeat of a recurring deadline — derived, never stored. */
  ghost?: boolean;
  /** Ghosts: the real deadline they project. */
  realId?: string;
}

/* ─── Grids ─── */

/** The 6 week rows shown for a month (0-based `month`), 7 days each, starting
 *  on the week start on/before the 1st. Always 6 rows, so paging never reflows. */
export function monthWeeks(year: number, month: number, weekStart: number): Ymd[][] {
  const first = new Date(year, month, 1);
  const back = (first.getDay() - weekStart + 7) % 7;
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => formatYmd(new Date(year, month, 1 - back + w * 7 + d))),
  );
}

/** The 7 days of the week starting at `start`. */
export function weekDays(start: Ymd): Ymd[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
}

export type Scale = "month" | "week" | "day";

/** The first and last day a scale shows around an anchor. */
export function visibleRange(scale: Scale, anchor: Ymd, weekStart: number): { from: Ymd; to: Ymd } {
  if (scale === "day") return { from: anchor, to: anchor };
  if (scale === "week") {
    const from = weekStartOf(anchor, weekStart);
    return { from, to: addDaysYmd(from, 6) };
  }
  const { year, month } = monthOf(anchor);
  const weeks = monthWeeks(year, month, weekStart);
  return { from: weeks[0][0], to: weeks[5][6] };
}

/** The anchor one page away. Month anchors are always the 1st. */
export function shiftAnchor(scale: Scale, anchor: Ymd, delta: number): Ymd {
  if (scale === "day") return addDaysYmd(anchor, delta);
  if (scale === "week") return addDaysYmd(anchor, delta * 7);
  const { year, month } = monthOf(anchor);
  return formatYmd(new Date(year, month + delta, 1));
}

/** Normalise an anchor for a scale: a month is its 1st, a week its first day. */
export function anchorFor(scale: Scale, day: Ymd, weekStart: number): Ymd {
  if (scale === "month") return `${day.slice(0, 8)}01`;
  if (scale === "week") return weekStartOf(day, weekStart);
  return day;
}

/**
 * Switching scales carries the anchor, so a toggle never teleports you:
 *  - into week/day from a month: the week (day) holding today if today is in
 *    that month, else the month's first week (1st);
 *  - into week/day from a week/day: the week holding it / its first day,
 *    or today when today is inside that week;
 *  - into a month: the month owning the week's middle day (the majority of a
 *    straddling week), or the day's own month.
 */
export function carryAnchor(from: Scale, to: Scale, anchor: Ymd, today: Ymd, weekStart: number): Ymd {
  if (from === to) return anchor;
  if (to === "month") {
    const day = from === "week" ? addDaysYmd(weekStartOf(anchor, weekStart), 3) : anchor;
    return anchorFor("month", day, weekStart);
  }
  let day: Ymd;
  if (from === "month") {
    day = today.slice(0, 7) === anchor.slice(0, 7) ? today : anchor;
  } else if (from === "week") {
    const start = weekStartOf(anchor, weekStart);
    day = today >= start && today <= addDaysYmd(start, 6) ? today : start;
  } else {
    day = anchor;
  }
  return anchorFor(to, day, weekStart);
}

/* ─── Ordering ─── */

/** Rank inside a day: what needs doing reads first, records recede.
 *  0 overdue deadline · 1 open deadline · 2 stage entry · 3 applied · 4 repeat ghost. */
export function eventRank(e: CalendarEvent, today: Ymd): number {
  if (e.ghost) return 4;
  if (e.kind === "deadline") return e.date < today ? 0 : 1;
  return e.kind === "stage" ? 2 : 3;
}

export function compareEvents(today: Ymd) {
  return (a: CalendarEvent, b: CalendarEvent) =>
    eventRank(a, today) - eventRank(b, today)
    || a.company.localeCompare(b.company)
    || a.title.localeCompare(b.title)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Events grouped by day, each day in rank order. */
export function groupByDay(events: CalendarEvent[], today: Ymd): Map<Ymd, CalendarEvent[]> {
  const map = new Map<Ymd, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e); else map.set(e.date, [e]);
  }
  const cmp = compareEvents(today);
  for (const list of map.values()) list.sort(cmp);
  return map;
}

/** Deadlines strictly before today, oldest first — the Day view's pinned group. */
export function overdueDeadlines(events: CalendarEvent[], today: Ymd): CalendarEvent[] {
  return events
    .filter((e) => e.kind === "deadline" && !e.ghost && e.date < today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : compareEvents(today)(a, b)));
}

/* ─── Measured overflow (month cells) ─── */

/** Chip geometry, px: the date strip above the chips, one chip + gap per slot. */
export const DATE_STRIP = 26;
export const LANE = 22;
const CELL_PAD = 4;

/** How many chip slots fit in a month row of height `rowH`. */
export function slotsFor(rowH: number): number {
  return Math.max(1, Math.floor((rowH - DATE_STRIP - CELL_PAD) / LANE));
}

/** Which of a day's events show in `slots` slots. When the day overflows, the
 *  last slot becomes "N more" — never a chip that pretends to be the last one. */
export function splitOverflow<T>(list: T[], slots: number): { shown: T[]; hidden: number } {
  if (list.length <= slots) return { shown: list, hidden: 0 };
  const keep = Math.max(0, slots - 1);
  return { shown: list.slice(0, keep), hidden: list.length - keep };
}

/* ─── Repeat ghosts ─── */

/** Future occurrences of recurring deadlines inside [from, to]: every
 *  `recurrenceDays` after the real due date, never before today (a repeat that
 *  would already be in the past isn't going to happen). Capped per source. */
export function projectGhosts(sources: CalendarEvent[], from: Ymd, to: Ymd, today: Ymd, cap = 60): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const floor = from > today ? from : today;
  for (const src of sources) {
    const n = src.recurrenceDays ?? 0;
    if (src.kind !== "deadline" || src.ghost || n <= 0) continue;
    // Jump straight to the first occurrence on/after the floor.
    const gap = diffDaysYmd(src.date, floor);
    let k = Math.max(1, Math.ceil(gap / n));
    for (let made = 0; made < cap; k++) {
      const date = addDaysYmd(src.date, k * n);
      if (date > to) break;
      if (date >= floor) {
        out.push({ ...src, id: `ghost:${src.entityId}:${date}`, realId: src.id, ghost: true, date });
        made++;
      }
    }
  }
  return out;
}

/* ─── Drag rules ─── */

/** Open deadlines move; an applied date moves only as a correction; stage
 *  entries (history) and ghosts (projections) never do. */
export function isDraggable(e: CalendarEvent): boolean {
  if (e.ghost) return false;
  return e.kind === "deadline" || e.kind === "applied";
}

/** Whether `e` may be dropped on `day`. You can't have applied tomorrow. */
export function canDrop(e: CalendarEvent, day: Ymd, today: Ymd): boolean {
  if (!isDraggable(e)) return false;
  if (e.kind === "applied") return day <= today;
  return true;
}

/** The (row, col) under a point inside a grid's rectangle, or null outside it. */
export function cellAtPoint(
  rect: { left: number; top: number; width: number; height: number },
  x: number, y: number, rows: number, cols: number,
): { row: number; col: number } | null {
  if (x < rect.left || x >= rect.left + rect.width || y < rect.top || y >= rect.top + rect.height) return null;
  const col = Math.min(cols - 1, Math.floor(((x - rect.left) / rect.width) * cols));
  const row = Math.min(rows - 1, Math.floor(((y - rect.top) / rect.height) * rows));
  return { row, col };
}

/* ─── Words ─── */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 deadlines, 5 applications, 1 stage change" — for a day's aria-label. */
export function describeDay(list: CalendarEvent[]): string {
  const deadlines = list.filter((e) => e.kind === "deadline" && !e.ghost).length;
  const applied = list.filter((e) => e.kind === "applied").length;
  const stages = list.filter((e) => e.kind === "stage").length;
  const parts = [
    deadlines && plural(deadlines, "deadline"),
    applied && plural(applied, "application"),
    stages && plural(stages, "stage change"),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "nothing scheduled";
}
