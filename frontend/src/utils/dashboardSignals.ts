/**
 * Pure computations that drive the Dashboard "Today strip", "Attention list",
 * streak counter, and weekly capacity meter. Kept here as side-effect-free
 * functions so they can be unit-tested and so the Dashboard component stays
 * thin (just renders the derived signals).
 */
import type { Application, Contact, Deadline } from "../types";

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

/** ───── Hero "Today" sentence ───── */
export interface HeroSignals {
  interviewsThisWeek: number;
  overdueFollowUps: number;
  /** Number of apps in Drafting state — "stuff you started but never sent." */
  draftingCount: number;
  /** Total active (non-archived) — used when nothing else is interesting. */
  totalActive: number;
  /** Number of unanalyzed AI fits. */
  unanalyzed: number;
}

export function computeHeroSignals(opts: {
  applications: Application[];
  deadlines: Deadline[];
  now?: Date;
}): HeroSignals {
  const now = opts.now ?? new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

  const active = opts.applications.filter((a) => !a.archived);

  let interviewsThisWeek = 0;
  for (const d of opts.deadlines) {
    if (d.completed) continue;
    const due = new Date(d.dueDate);
    if (due >= weekStart && due < weekEnd && /interview/i.test(d.type)) {
      interviewsThisWeek += 1;
    }
  }

  let overdueFollowUps = 0;
  for (const d of opts.deadlines) {
    if (d.completed) continue;
    const due = new Date(d.dueDate);
    if (due < today && /follow.?up/i.test(d.type)) overdueFollowUps += 1;
  }

  const draftingCount = active.filter((a) => a.stage === "Drafting").length;
  const unanalyzed = active.filter((a) => !a.fit || (a.fit && a.fit.status !== "succeeded")).length;

  return {
    interviewsThisWeek,
    overdueFollowUps,
    draftingCount,
    totalActive: active.length,
    unanalyzed,
  };
}

/** Build a small set of human sentences from the signals.
 *  Returns at most 2 phrases; the consumer wraps them in "You have X and Y." */
export function heroPhrases(s: HeroSignals): Array<{ text: string; href: string }> {
  const out: Array<{ text: string; href: string }> = [];
  if (s.interviewsThisWeek > 0) {
    out.push({
      text: `${s.interviewsThisWeek} interview${s.interviewsThisWeek === 1 ? "" : "s"} this week`,
      href: "/calendar",
    });
  }
  if (s.overdueFollowUps > 0) {
    out.push({
      text: `${s.overdueFollowUps} overdue follow-up${s.overdueFollowUps === 1 ? "" : "s"}`,
      href: "/deadlines",
    });
  }
  if (out.length === 0 && s.draftingCount > 0) {
    out.push({
      text: `${s.draftingCount} draft${s.draftingCount === 1 ? "" : "s"} to finish`,
      href: "/applications?stage=Drafting",
    });
  }
  return out.slice(0, 2);
}

/** ───── Attention list ───── */

export type AttentionKind =
  | "overdue_deadline"
  | "follow_up_due"
  | "stale_applied"
  | "draft_pending"
  | "interview_soon"
  | "decision_soon";

export interface AttentionItem {
  kind: AttentionKind;
  /** Severity 0..1; consumers may sort by this descending. */
  urgency: number;
  /** One-line headline. */
  title: string;
  /** Optional sub-line for context. */
  subtitle?: string;
  /** Where clicking takes the user. */
  href: string;
  /** Optional CTA label. Falls back to "Open". */
  cta?: string;
}

const STALE_APPLIED_DAYS = 14;

/** Stable sort: urgency desc, then by title. */
function rank(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));
}

export function computeAttentionItems(opts: {
  applications: Application[];
  deadlines: Deadline[];
  contacts: Contact[];
  /** Cap on returned items. Default 5. */
  limit?: number;
  now?: Date;
}): AttentionItem[] {
  const now = opts.now ?? new Date();
  const today = startOfDay(now);
  const limit = opts.limit ?? 5;
  const items: AttentionItem[] = [];

  // Overdue deadlines (highest urgency)
  for (const d of opts.deadlines) {
    if (d.completed) continue;
    const due = startOfDay(new Date(d.dueDate));
    const overdueBy = Math.round((today.getTime() - due.getTime()) / DAY_MS);
    if (overdueBy >= 0) {
      items.push({
        kind: "overdue_deadline",
        urgency: 1 - Math.max(0, 1 - overdueBy / 30) + 0.6, // cap-then-add
        title: `${d.type} — ${overdueBy === 0 ? "due today" : `${overdueBy}d overdue`}`,
        subtitle: d.notes || undefined,
        href: "/deadlines",
        cta: "Mark done",
      });
    } else if (overdueBy >= -2) {
      items.push({
        kind: "interview_soon",
        urgency: 0.7,
        title: `${d.type} — due in ${-overdueBy}d`,
        href: "/deadlines",
        cta: "Open",
      });
    }
  }

  // Stale Applied apps (>14 days, no contact linked)
  for (const a of opts.applications) {
    if (a.archived) continue;
    if (a.stage !== "Applied") continue;
    const last = a.stageHistory.length > 0
      ? new Date(a.stageHistory[a.stageHistory.length - 1].date)
      : new Date(a.applicationDate);
    const days = Math.round((today.getTime() - startOfDay(last).getTime()) / DAY_MS);
    if (days < STALE_APPLIED_DAYS) continue;
    if (a.contactId) continue;
    items.push({
      kind: "stale_applied",
      urgency: Math.min(0.55 + days / 100, 0.85),
      title: `Follow up at ${a.company}`,
      subtitle: `${a.role} · applied ${days}d ago`,
      href: `/applications?focus=${a._id}`,
      cta: "Add follow-up",
    });
  }

  // Drafting with tailor session — finish it
  for (const a of opts.applications) {
    if (a.archived) continue;
    if (a.stage !== "Drafting") continue;
    if (!a.tailorSessionId) continue;
    items.push({
      kind: "draft_pending",
      urgency: 0.4,
      title: `Finish your draft for ${a.company}`,
      subtitle: a.role,
      href: `/tailor?session=${a.tailorSessionId}`,
      cta: "Resume",
    });
  }

  // Offer decisions due soon (Offer stage + linked deadline)
  for (const d of opts.deadlines) {
    if (d.completed) continue;
    if (!/decision|offer/i.test(d.type)) continue;
    const due = startOfDay(new Date(d.dueDate));
    const remaining = Math.round((due.getTime() - today.getTime()) / DAY_MS);
    if (remaining >= 0 && remaining <= 7) {
      items.push({
        kind: "decision_soon",
        urgency: 0.92,
        title: `Decide on offer — ${remaining === 0 ? "today" : `${remaining}d left`}`,
        subtitle: d.notes || undefined,
        href: "/deadlines",
        cta: "Decide",
      });
    }
  }

  return rank(items).slice(0, limit);
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
