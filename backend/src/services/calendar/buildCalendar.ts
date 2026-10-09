/**
 * The calendar's data for one date range, built in a handful of indexed
 * queries (replaces the client fetching up to 1,000 full applications plus
 * every deadline and deriving events itself).
 *
 * Events are single days:
 *  - `applied`  — the day an application was submitted (not for Drafting);
 *  - `stage`    — the day it entered its CURRENT stage (none for Applied —
 *                 the applied event already marks that day);
 *  - `deadline` — an open deadline's due day. Completed deadlines are not on
 *                 the calendar (it looks forward).
 *
 * Besides the range's events, the response carries every open overdue
 * deadline (the Day view pins them) and every open recurring deadline due
 * before the range ends (the client projects its repeats), and a summary of
 * each application referenced, for the hover card.
 *
 * Filters are the Applications page's own (URL-shared). A deadline linked to
 * an application follows that application's filters; a standalone deadline
 * shows only when no company / stage / resume / source filter narrows the
 * view, on the Active tab, and — with a search — when its type or notes match.
 */
import type { Request } from "express";
import { Types } from "mongoose";
import { Application, STAGES, type Stage } from "../../models/Application.js";
import { Deadline } from "../../models/Deadline.js";
import { listFilters, loadFitSummaries } from "../../routes/applications.js";
import { searchRegex } from "../../utils/regex.js";
import { dayIn, diffDays, todayIn, utcDay } from "./days.js";

export interface CalendarEventDTO {
  id: string;
  kind: "deadline" | "applied" | "stage";
  date: string;
  entityId: string;
  applicationId: string | null;
  title: string;
  company: string;
  role: string;
  stage?: Stage;
  enteredStage?: Stage;
  notes?: string;
  recurrenceDays?: number;
}

export interface CalendarAppDTO {
  _id: string;
  company: string;
  role: string;
  stage: Stage;
  /** Day it entered its current stage. */
  stageSince: string;
  applied: string;
  location: string;
  salary: string;
  jobType: string;
  resumeId: string | null;
  companyId: string | null;
  archived: boolean;
  /** The one match score, 0–10. */
  fit: { score: number } | null;
  nextDeadline: { id: string; type: string; date: string } | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  today: string;
  events: CalendarEventDTO[];
  applications: Record<string, CalendarAppDTO>;
}

const APP_FIELDS = "company role stage stageHistory applicationDate location salary jobType resumeId companyId archived tailorSessionId";

type AppDoc = {
  _id: Types.ObjectId;
  company: string;
  role: string;
  stage: Stage;
  stageHistory?: { stage: Stage; date: Date }[];
  applicationDate?: Date;
  location?: string;
  salary?: string;
  jobType?: string;
  resumeId?: Types.ObjectId | null;
  companyId?: Types.ObjectId | null;
  archived?: boolean;
  tailorSessionId?: Types.ObjectId | null;
};

type DeadlineDoc = {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId | null;
  type: string;
  dueDate: Date;
  notes?: string;
  recurrenceDays?: number;
};

/** The history entry for the application's current stage: the latest entry
 *  INTO that stage (older toggles are noise on a calendar). */
function currentStageEntry(app: AppDoc): { stage: Stage; date: Date } | null {
  const h = app.stageHistory ?? [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].stage === app.stage) return h[i];
  return h.length ? h[h.length - 1] : null;
}

export async function buildCalendar(
  req: Request,
  userId: Types.ObjectId,
  { from, to, tz }: { from: string; to: string; tz: string },
): Promise<CalendarResponse> {
  const today = todayIn(tz);
  // Instants wide enough that every zone's version of [from, to] is inside;
  // each document's exact day is decided afterwards with `dayIn`.
  const lo = utcDay(from, -1);
  const hi = utcDay(to, 2);
  const todayHi = utcDay(today, 2);

  const q = req.query;
  const stage = typeof q.stage === "string" && (STAGES as readonly string[]).includes(q.stage) ? (q.stage as Stage) : null;
  const appMatch: Record<string, unknown> = { ...listFilters(req, userId), ...(stage ? { stage } : {}) };
  const narrowed = !!(stage || (typeof q.company === "string" && q.company.trim()) || q.resumeId || q.source);
  const search = searchRegex(q.search);
  const archivedTab = q.archived === "true";

  const open = { userId, completed: false };
  const [records, deadlineDocs] = await Promise.all([
    // $and, not a spread: the filters' own $or (the search) must survive the
    // range's. Every in-range record matches the filters — the deadline loop
    // below trusts that.
    Application.find({
      $and: [appMatch, { $or: [{ applicationDate: { $gte: lo, $lt: hi } }, { "stageHistory.date": { $gte: lo, $lt: hi } }] }],
    }).select(APP_FIELDS).lean<AppDoc[]>(),
    // In range ∪ overdue ∪ recurring sources — one query. Newest first, so a
    // pathological backlog of ancient open deadlines is what the cap drops.
    Deadline.find({
      ...open,
      $or: [
        { dueDate: { $gte: lo, $lt: hi } },
        { dueDate: { $lt: todayHi } },
        { recurrenceDays: { $gt: 0 }, dueDate: { $lt: hi } },
      ],
    }).sort({ dueDate: -1 }).limit(2000).select("applicationId type dueDate notes recurrenceDays").lean<DeadlineDoc[]>(),
  ]);

  const apps = new Map<string, AppDoc>(records.map((a) => [String(a._id), a]));
  const events: CalendarEventDTO[] = [];

  for (const app of records) {
    const id = String(app._id);
    const base = { applicationId: id, entityId: id, company: app.company, role: app.role, stage: app.stage };
    const applied = dayIn(app.applicationDate, tz);
    if (app.stage !== "Drafting" && applied >= from && applied <= to) {
      events.push({ ...base, id: `applied:${id}`, kind: "applied", date: applied, title: app.company });
    }
    const entry = currentStageEntry(app);
    if (entry && entry.stage !== "Applied") {
      const day = dayIn(entry.date, tz);
      if (day >= from && day <= to) {
        events.push({ ...base, id: `stage:${id}`, kind: "stage", date: day, title: app.company, enteredStage: entry.stage });
      }
    }
  }

  // Deadlines: decide each one's day, keep the ones this response needs, and
  // resolve the applications they point at.
  const wanted = deadlineDocs
    .map((d) => ({ d, day: dayIn(d.dueDate, tz) }))
    .filter(({ d, day }) => (day >= from && day <= to) || day < today || ((d.recurrenceDays ?? 0) > 0 && day <= to));
  const linkedIds = [...new Set(wanted.map(({ d }) => d.applicationId && String(d.applicationId)).filter((x): x is string => !!x))];
  const missing = linkedIds.filter((id) => !apps.has(id)).map((id) => new Types.ObjectId(id));
  const [linkedApps, matchingIds] = missing.length
    ? await Promise.all([
        Application.find({ _id: { $in: missing }, userId }).select(APP_FIELDS).lean<AppDoc[]>(),
        Application.find({ _id: { $in: missing }, ...appMatch }).select("_id").lean<{ _id: Types.ObjectId }[]>(),
      ])
    : [[], []];
  const exists = new Set([...apps.keys(), ...linkedApps.map((a) => String(a._id))]);
  const matches = new Set([...apps.keys(), ...matchingIds.map((a) => String(a._id))]);
  for (const a of linkedApps) if (matches.has(String(a._id))) apps.set(String(a._id), a);

  for (const { d, day } of wanted) {
    const appId = d.applicationId ? String(d.applicationId) : null;
    const linked = appId && exists.has(appId) ? appId : null; // a deleted application → standalone
    if (linked) {
      if (!matches.has(linked)) continue;
    } else {
      if (narrowed || archivedTab) continue;
      if (search && !search.test(d.type) && !search.test(d.notes ?? "")) continue;
    }
    const app = linked ? apps.get(linked) : undefined;
    events.push({
      id: `deadline:${d._id}`,
      kind: "deadline",
      date: day,
      entityId: String(d._id),
      applicationId: linked,
      title: d.type,
      company: app?.company ?? "",
      role: app?.role ?? "",
      ...(app ? { stage: app.stage } : {}),
      notes: d.notes ?? "",
      recurrenceDays: d.recurrenceDays ?? 0,
    });
  }

  // Hover-card summaries for every application an event points at.
  const referenced = [...new Set(events.map((e) => e.applicationId).filter((x): x is string => !!x))];
  const summaryApps = referenced.map((id) => apps.get(id)!).filter(Boolean);
  const [fits, nextDeadlines] = await Promise.all([
    loadFitSummaries(summaryApps.map((a) => ({ _id: a._id, tailorSessionId: a.tailorSessionId ?? null })), { withSummary: false }),
    referenced.length
      ? Deadline.find({ ...open, applicationId: { $in: referenced.map((id) => new Types.ObjectId(id)) } })
          .sort({ dueDate: 1 }).select("applicationId type dueDate").lean<DeadlineDoc[]>()
      : Promise.resolve([] as DeadlineDoc[]),
  ]);
  const nextByApp = new Map<string, DeadlineDoc>();
  for (const d of nextDeadlines) {
    const k = String(d.applicationId);
    if (!nextByApp.has(k)) nextByApp.set(k, d);
  }

  const applications: Record<string, CalendarAppDTO> = {};
  for (const app of summaryApps) {
    const id = String(app._id);
    const fit = fits.get(id);
    const next = nextByApp.get(id);
    const entry = currentStageEntry(app);
    applications[id] = {
      _id: id,
      company: app.company,
      role: app.role,
      stage: app.stage,
      stageSince: dayIn(entry?.date ?? app.applicationDate, tz),
      applied: dayIn(app.applicationDate, tz),
      location: app.location ?? "",
      salary: app.salary ?? "",
      jobType: app.jobType ?? "",
      resumeId: app.resumeId ? String(app.resumeId) : null,
      companyId: app.companyId ? String(app.companyId) : null,
      archived: !!app.archived,
      fit: fit && fit.status === "succeeded" && fit.score !== null ? { score: fit.score } : null,
      nextDeadline: next ? { id: String(next._id), type: next.type, date: dayIn(next.dueDate, tz) } : null,
    };
  }

  return { from, to, today, events, applications };
}

/** Longest range one request may ask for (a month grid is 42 days). */
export const MAX_RANGE_DAYS = 100;
export { diffDays };
