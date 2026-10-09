/** What an application is waiting on — the one question its stage asks.
 *
 *  Every surface that shows an application's "now" reads it from here: the
 *  Ledger's focus column, the Trail, the Desk list, Board cards, Sweep. Pure
 *  (days in, words out), so it's tested (focus.test.ts) and every surface
 *  says the same thing about the same application.
 *
 *    Offer      → when must I decide?        "Decide by Mon, Oct 12"
 *    Interview  → when is the next round?    "Interview prep · Fri, Oct 9"
 *    OA         → when is it due?            "OA due tomorrow"
 *    Applied    → should I follow up?        "Sent 4d ago" · "Silent 31d"
 *    Drafting   → have I sent it?            "Not sent yet"
 *    Rejected   → how did it end?            "Closed after 30d"
 *
 *  Time is measured in calendar days relative to today (negative = past),
 *  always through utils/dates (a picked day is its UTC date, a moment the
 *  viewer's local day). The reply window is the person's own median wait for
 *  a first reply (GET /applications/insights). */
import { dayOf, diffDaysYmd, formatDay, type Ymd } from "../../../utils/dates.ts";
import type { Application, Deadline, ReplyWindow, Stage } from "../../../types";

export type Tone = "fg" | "muted" | "warn" | "danger";

export type { ReplyWindow };
export const DEFAULT_REPLY_WINDOW: ReplyWindow = { days: 14, sample: 0, isDefault: true, lateReplies: 0 };

/** Furthest along first: what matters most rises to the top. */
export const PROGRESS_ORDER: Stage[] = ["Offer", "Interview", "OA", "Applied", "Drafting", "Rejected"];

/** The focus column's heading in each stage's group. */
export const FOCUS_LABEL: Record<Stage, string> = {
  Offer: "Decision", Interview: "Next", OA: "Assessment", Applied: "Waiting", Drafting: "Status", Rejected: "Outcome",
};

/* ─── Deadlines ─── */

export type DeadlineKind = "oa" | "followup" | "prep" | "decision" | "thanks" | "other";

export function deadlineKind(type: string): DeadlineKind {
  switch (type) {
    case "OA due date": return "oa";
    case "Follow-up reminder": return "followup";
    case "Interview prep": return "prep";
    case "Offer decision": return "decision";
    case "Thank you note": return "thanks";
    default: return "other";
  }
}

const KIND_SHORT: Record<DeadlineKind, string> = {
  oa: "OA due", followup: "Follow up", prep: "Prep", decision: "Decide", thanks: "Thank-you", other: "Due",
};
/** "Other" is the dialog's catch-all — it names nothing, so it reads as plain "Due". */
const typeName = (d: Deadline) => (d.type === "Other" ? "Due" : d.type);
const KIND_OVERDUE: Record<DeadlineKind, string> = {
  oa: "OA overdue", followup: "Follow-up overdue", prep: "Prep overdue", decision: "Decision overdue", thanks: "Thank-you overdue", other: "Overdue",
};

/** Overdue by more than this, an open deadline is treated as abandoned: it
 *  stays on the Deadlines page and the calendar, but it no longer speaks for
 *  the application (an Offer shouldn't read "Prep overdue 58d"). */
export const STALE_AFTER_DAYS = 14;

/** The soonest open deadline of each application (an overdue one is the
 *  soonest) — completed, standalone and abandoned ones aside. */
export function nextDeadlines(deadlines: readonly Deadline[], today: Ymd): Map<string, Deadline> {
  const out = new Map<string, Deadline>();
  for (const d of deadlines) {
    if (!d.applicationId || d.completed) continue;
    const day = dayOf(d.dueDate);
    if (!day || diffDaysYmd(day, today) > STALE_AFTER_DAYS) continue;
    const cur = out.get(d.applicationId);
    if (!cur || day < dayOf(cur.dueDate)) out.set(d.applicationId, d);
  }
  return out;
}

/* ─── Days ─── */

const longDay = (day: Ymd) => formatDay(day, { weekday: "short", month: "short", day: "numeric" });
const shortDay = (day: Ymd) => formatDay(day, { month: "short", day: "numeric" });

/** "3d overdue" · "today" · "tomorrow" · "in 5d". */
export function relativeDue(k: number): string {
  return k < 0 ? `${-k}d overdue` : k === 0 ? "today" : k === 1 ? "tomorrow" : `in ${k}d`;
}

interface Step { stage: Stage; day: Ymd }

/** The application's history as days, oldest first. Legacy documents may
 *  have no history (→ one step on the applied day) or start past Applied
 *  (an Applied step on the applied day is put in front), and a backdated
 *  applied day pulls the first Applied step back to it. */
export function historySteps(app: Pick<Application, "stage" | "stageHistory" | "applicationDate">): Step[] {
  const applied = dayOf(app.applicationDate);
  const steps: Step[] = (app.stageHistory ?? [])
    .map((e) => ({ stage: e.stage, day: dayOf(e.date) }))
    .filter((e): e is Step => !!e.day)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (steps.length === 0) return applied ? [{ stage: app.stage, day: applied }] : [];
  const first = steps[0];
  if (applied && applied < first.day && first.stage !== "Drafting") {
    if (first.stage === "Applied") steps[0] = { ...first, day: applied };
    else steps.unshift({ stage: "Applied", day: applied });
  }
  return steps;
}

/** Whole days since the last move (or since applying). */
export function daysInStage(app: Pick<Application, "stage" | "stageHistory" | "applicationDate">, today: Ymd): number {
  const steps = historySteps(app);
  const last = steps[steps.length - 1];
  return last ? Math.max(0, diffDaysYmd(last.day, today)) : 0;
}

/** Days until a deadline is due (negative = overdue). */
export function dueIn(d: Pick<Deadline, "dueDate">, today: Ymd): number {
  const day = dayOf(d.dueDate);
  return day ? diffDaysYmd(today, day) : 0;
}

/* ─── The focus ─── */

export interface Focus {
  /** The line that matters ("OA due tomorrow"). */
  text: string;
  /** Quiet context under it ("Fri, Oct 9"). */
  detail: string;
  /** One short phrase for tight places — Desk rows, Board cards, phones. */
  short: string;
  tone: Tone;
}

const OPEN_STAGES: ReadonlySet<Stage> = new Set(["Applied", "OA", "Interview"]);

/** A dated next step within two weeks (or overdue) — the application is in motion. */
const hasSoon = (next: Deadline | undefined, today: Ymd) => !!next && dueIn(next, today) <= 14;

/** Waiting past the reply window with nothing dated ahead: the trail fades. */
export function isCold(app: Application, next: Deadline | undefined, rw: ReplyWindow, today: Ymd): boolean {
  return OPEN_STAGES.has(app.stage) && !hasSoon(next, today) && daysInStage(app, today) > rw.days;
}

function datedFocus(next: Deadline, today: Ymd, text: (day: Ymd, k: number) => string): Focus {
  const k = dueIn(next, today), day = dayOf(next.dueDate) as Ymd, kind = deadlineKind(next.type);
  if (k < 0) {
    const what = kind === "other" ? (next.type === "Other" ? "Overdue" : `${next.type} overdue`) : KIND_OVERDUE[kind];
    return { text: what, detail: `${-k}d late · ${longDay(day)}`, short: what, tone: "danger" };
  }
  return {
    text: text(day, k),
    detail: k <= 1 ? longDay(day) : relativeDue(k),
    short: `${kind === "other" ? typeName(next) : KIND_SHORT[kind]} ${relativeDue(k)}`,
    tone: k <= 1 ? "warn" : "fg",
  };
}

export function rowFocus(app: Application, next: Deadline | undefined, rw: ReplyWindow, today: Ymd): Focus {
  const d = daysInStage(app, today);
  const pay = app.salary?.trim();
  switch (app.stage) {
    case "Offer": {
      if (next) {
        const f = datedFocus(next, today, (day, k) =>
          deadlineKind(next.type) === "decision" ? `Decide by ${longDay(day)}` : `${typeName(next)} · ${k <= 1 ? relativeDue(k) : longDay(day)}`);
        return { ...f, detail: [f.detail, pay].filter(Boolean).join(" · ") };
      }
      return { text: "Offer received", detail: [d === 0 ? "today" : `${d}d ago`, pay].filter(Boolean).join(" · "), short: "Offer received", tone: "fg" };
    }
    case "Interview":
      if (next) return datedFocus(next, today, (day, k) => `${typeName(next)} · ${k <= 1 ? relativeDue(k) : longDay(day)}`);
      if (d <= rw.days) return { text: "Interviewing", detail: d === 0 ? "moved today" : `${d}d since the last step`, short: "Interviewing", tone: "fg" };
      return { text: `Quiet ${d}d`, detail: "no next round logged", short: `Quiet ${d}d`, tone: "muted" };
    case "OA":
      if (next) return datedFocus(next, today, (day, k) => deadlineKind(next.type) === "oa"
        ? (k <= 1 ? `OA due ${relativeDue(k)}` : `OA due ${longDay(day)}`)
        : `${typeName(next)} · ${k <= 1 ? relativeDue(k) : longDay(day)}`);
      return { text: `In OA · ${d}d`, detail: "no due date set", short: `OA · ${d}d`, tone: d > rw.days ? "muted" : "fg" };
    case "Applied":
      if (next) return datedFocus(next, today, (day, k) => deadlineKind(next.type) === "followup"
        ? `Follow up ${k <= 1 ? relativeDue(k) : longDay(day)}`
        : `${typeName(next)} · ${k <= 1 ? relativeDue(k) : longDay(day)}`);
      if (d <= rw.days) {
        return { text: d === 0 ? "Sent today" : `Sent ${d}d ago`, detail: "inside your reply window", short: d === 0 ? "Sent today" : `Sent ${d}d ago`, tone: "fg" };
      }
      return {
        text: `Silent ${d}d`,
        detail: d > 2 * rw.days ? "past your reply window" : "replies usually come sooner",
        short: `Silent ${d}d`,
        tone: "muted",
      };
    case "Drafting":
      if (app.aiExtractionStatus === "processing") return { text: "Reading the posting…", detail: "the fit check follows", short: "Reading…", tone: "muted" };
      if (!(app.hasJobDescription ?? !!app.jobDescription?.trim())) {
        return { text: "Needs job description", detail: "add it to check your fit", short: "Needs JD", tone: "muted" };
      }
      return { text: "Not sent yet", detail: d === 0 ? "saved today" : `saved ${d}d ago`, short: "Not sent yet", tone: "fg" };
    case "Rejected": {
      const steps = historySteps(app);
      const closed = steps[steps.length - 1];
      const start = steps.find((s) => s.stage !== "Drafting");
      const prev = steps.length > 1 ? steps[steps.length - 2].stage : null;
      if (!closed || !start || closed === start) return { text: "Closed", detail: "", short: "Closed", tone: "muted" };
      return {
        text: `Closed after ${diffDaysYmd(start.day, closed.day)}d`,
        detail: prev && prev !== "Applied" && prev !== "Drafting" ? `reached ${prev}` : "from Applied",
        short: `Closed ${shortDay(closed.day)}`,
        tone: "muted",
      };
    }
  }
}

/* ─── Momentum ─── */

export type Momentum = "motion" | "waiting" | "drafts" | "closed";
export const MOMENTUM_ORDER: Momentum[] = ["motion", "waiting", "drafts", "closed"];
export const MOMENTUM_LABEL: Record<Momentum, string> = { motion: "In motion", waiting: "Waiting", drafts: "Drafts", closed: "Closed" };

/** In motion = something dated in the next two weeks (or overdue), or a move
 *  this week. Superhuman's "today / another day / done", for a job search. */
export function momentum(app: Application, next: Deadline | undefined, today: Ymd): Momentum {
  if (app.stage === "Rejected") return "closed";
  if (app.stage === "Drafting") return "drafts";
  return hasSoon(next, today) || daysInStage(app, today) <= 7 ? "motion" : "waiting";
}

/* ─── Order ─── */

export type RowOrder = "smart" | "applied" | "fit" | "company";

/** "Next up": dated next steps first (soonest first), then the most recently moved. */
export function compareSmart(a: Application, b: Application, next: Map<string, Deadline>, today: Ymd): number {
  const na = next.get(a._id), nb = next.get(b._id);
  if (na && nb) return dueIn(na, today) - dueIn(nb, today) || daysInStage(a, today) - daysInStage(b, today);
  if (na) return -1;
  if (nb) return 1;
  return daysInStage(a, today) - daysInStage(b, today);
}

export function sortApplications(apps: readonly Application[], order: RowOrder, next: Map<string, Deadline>, today: Ymd): Application[] {
  const list = [...apps];
  switch (order) {
    case "smart": return list.sort((a, b) => compareSmart(a, b, next, today));
    case "applied": return list.sort((a, b) => (dayOf(b.applicationDate) || "").localeCompare(dayOf(a.applicationDate) || ""));
    case "fit": {
      const score = (a: Application) => (a.fit?.status === "succeeded" && typeof a.fit.score === "number" ? a.fit.score : -1);
      return list.sort((a, b) => score(b) - score(a));
    }
    case "company": return list.sort((a, b) => a.company.localeCompare(b.company) || a.role.localeCompare(b.role));
  }
}

/** The quiet line on a stage group's strip ("2 due this week"). */
export function stageSummary(stage: Stage, apps: readonly Application[], next: Map<string, Deadline>, rw: ReplyWindow, today: Ymd): string {
  const dues = apps.flatMap((a) => { const n = next.get(a._id); return n ? [dueIn(n, today)] : []; });
  const overdue = dues.filter((k) => k < 0).length;
  const parts: string[] = [];
  if (overdue) parts.push(`${overdue} overdue`);
  switch (stage) {
    case "Offer": {
      const ahead = dues.filter((k) => k >= 0);
      if (ahead.length) parts.push(`decide within ${Math.max(...ahead)} day${Math.max(...ahead) === 1 ? "" : "s"}`);
      break;
    }
    case "Interview":
    case "OA": {
      const week = dues.filter((k) => k >= 0 && k <= 7).length;
      if (week) parts.push(`${week} this week`);
      break;
    }
    case "Applied": {
      const past = apps.filter((a) => !next.has(a._id) && daysInStage(a, today) > 2 * rw.days).length;
      parts.push(`replies usually come within ${rw.days} days`);
      if (past) parts.push(`${past} past it`);
      break;
    }
    default: break;
  }
  return parts.join(" · ");
}

export function momentumSummary(m: Momentum, rw: ReplyWindow): string {
  switch (m) {
    case "motion": return "dated in the next two weeks, or moved this week";
    case "waiting": return `replies usually come within ${rw.days} days`;
    case "drafts": return "not sent yet";
    case "closed": return "";
  }
}

/* ─── The trail ─── */

export interface TrailSegment {
  stage: Stage;
  /** Days relative to today (negative = past). */
  from: number;
  to: number;
  current: boolean;
}

export interface TrailShape {
  segments: TrailSegment[];
  /** Where each stage began (the dots). */
  nodes: { stage: Stage; at: number }[];
  /** Day it was rejected — the trail ends there with a cross. */
  closedAt: number | null;
  /** Still moving: the trail ends in a dot at today. */
  live: boolean;
  /** Past the reply window: the current segment fades from `fadeFrom` to `fadeTo` (days, absolute). */
  fade: { from: number; to: number } | null;
  /** The next dated step (a diamond ahead of today, or behind it when overdue). */
  next: { at: number; label: string; overdue: boolean } | null;
}

export function trailShape(app: Application, next: Deadline | undefined, rw: ReplyWindow, today: Ymd): TrailShape {
  const steps = historySteps(app).map((s) => ({ stage: s.stage, at: Math.min(0, diffDaysYmd(today, s.day)) }));
  const segments: TrailSegment[] = [];
  let closedAt: number | null = null;
  steps.forEach((s, i) => {
    if (s.stage === "Rejected") { closedAt ??= s.at; return; }
    if (closedAt !== null) return;
    const to = i + 1 < steps.length ? steps[i + 1].at : 0;
    segments.push({ stage: s.stage, from: s.at, to, current: i === steps.length - 1 });
  });
  const cold = isCold(app, next, rw, today);
  const current = segments.find((s) => s.current);
  const kind = next ? deadlineKind(next.type) : null;
  return {
    segments,
    nodes: steps.filter((s) => s.stage !== "Rejected").map(({ stage, at }) => ({ stage, at })),
    closedAt,
    live: app.stage !== "Rejected" && app.stage !== "Drafting" && !cold,
    fade: cold && current ? { from: current.from + rw.days, to: current.from + 2 * rw.days } : null,
    next: next && kind ? (() => {
      const at = dueIn(next, today);
      const label = at < 0
        ? `${kind === "other" ? (next.type === "Other" ? "Overdue" : `${next.type} overdue`) : KIND_OVERDUE[kind]} · ${-at}d`
        : kind === "other" ? typeName(next) : KIND_SHORT[kind];
      return { at, label, overdue: at < 0 };
    })() : null,
  };
}
