/**
 * Pure computations that drive the Dashboard streak counter and weekly
 * capacity meter. Kept here as side-effect-free functions so they can be
 * unit-tested and so the Dashboard component stays thin.
 */
import type { Application } from "../types";

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function startOfWeek(d: Date): Date {
  // Week starts Monday (industry standard for "this week")
  const n = startOfDay(d);
  const day = n.getDay(); // 0 = Sun .. 6 = Sat
  const offset = (day + 6) % 7; // days since Monday
  n.setDate(n.getDate() - offset);
  return n;
}

/** ───── Streak ───── */

export interface StreakResult {
  /** Consecutive days (including today, if active) with ≥1 application created. */
  current: number;
  /** Longest streak in last 90 days. */
  best: number;
  /** True when today is in the streak (encourages "keep it going"). */
  activeToday: boolean;
}

export function computeActivityStreak(apps: Application[], now: Date = new Date()): StreakResult {
  if (apps.length === 0) return { current: 0, best: 0, activeToday: false };
  // Build a set of YYYY-MM-DD strings on which the user *reported applying*.
  // We prefer applicationDate (the user-asserted truth) over createdAt (the
  // server insertion time) — that way CSV imports of older history populate
  // the streak correctly instead of all collapsing onto the import day.
  const days = new Set<string>();
  for (const a of apps) {
    const d = new Date(a.applicationDate || a.createdAt);
    days.add(startOfDay(d).toISOString().slice(0, 10));
  }
  let current = 0;
  let best = 0;
  // Walk backwards from today; first miss ends the current streak.
  const today = startOfDay(now);
  for (let i = 0; i < 365; i += 1) {
    const probe = new Date(today.getTime() - i * DAY_MS);
    const key = probe.toISOString().slice(0, 10);
    if (days.has(key)) {
      if (i === current) current += 1;
    } else if (i === 0) {
      // No activity today — current streak is 0
      current = 0;
      break;
    } else {
      break;
    }
  }
  // Best streak: simple scan in last 365 days
  let run = 0;
  for (let i = 0; i < 365; i += 1) {
    const probe = new Date(today.getTime() - i * DAY_MS);
    const key = probe.toISOString().slice(0, 10);
    if (days.has(key)) { run += 1; if (run > best) best = run; }
    else { run = 0; }
  }
  return { current, best, activeToday: current > 0 };
}

/** ───── Weekly capacity ───── */
export interface WeeklyCapacityResult {
  thisWeek: number;
  goal: number;
  /** 0..1 fraction of progress. */
  progress: number;
  /** Days remaining in this week (incl. today). */
  daysLeft: number;
}

export function computeWeeklyCapacity(apps: Application[], goal: number, now: Date = new Date()): WeeklyCapacityResult {
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  // Same applicationDate-preferred logic as the streak — historical CSV imports
  // shouldn't inflate the current week.
  const thisWeek = apps.filter((a) => {
    const d = new Date(a.applicationDate || a.createdAt);
    return d >= weekStart && d < weekEnd && !a.archived;
  }).length;
  const dayIndex = Math.floor((startOfDay(now).getTime() - weekStart.getTime()) / DAY_MS);
  const daysLeft = Math.max(0, 7 - dayIndex);
  const progress = goal === 0 ? 0 : Math.min(1, thisWeek / goal);
  return { thisWeek, goal, progress, daysLeft };
}
