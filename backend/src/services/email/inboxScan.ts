/**
 * Inbox scan → review queue, as resumable AI-job steps (feature inbox.sort).
 *
 *   list      — the optimized Gmail query, paginated (ids only)
 *   fetch     — message bodies, filtered as they arrive: newsletters and
 *               job-alert digests dropped, ATS senders and application
 *               signals kept; only a short body slice is retained
 *   classify  — threads in batches of 15 through the gateway, four at a time
 *   finalize  — de-duplicate against the user's applications and write the
 *               review queue; nothing is applied until the person reviews it
 *
 * Every phase stops inside the step's time budget and saves its cursor, so a
 * heavy inbox is several short steps instead of one function timeout. The
 * EmailScanJob row stays the UI's truth (status, progress, counts); the
 * AiJob row is the engine. Email text lives in the job state only while the
 * scan runs — it is cleared when the job settles.
 */
import { google, gmail_v1 } from "googleapis";
import { z } from "zod";
import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { decrypt } from "../../utils/encryption.js";
import { User } from "../../models/User.js";
import { Application, STAGES, type Stage } from "../../models/Application.js";
import { Notification } from "../../models/Notification.js";
import { EmailScanJob, type IEmailScanJob } from "../../models/EmailScanJob.js";
import { EmailScanCandidate } from "../../models/EmailScanCandidate.js";
import { AiJob } from "../../models/AiJob.js";
import { buildFirstScanQuery } from "./firstScanQuery.js";
import { isAtsSender, isLikelyNewsletter, hasNegativeSignal } from "./atsDomains.js";
import { runAiObject, type AiUser } from "../ai/gateway.js";
import { registerJobHandler, startAiJob, UserFacingError, type JobContext } from "../ai/jobs.js";
import { laneFor } from "../ai/routing.js";
import { AiError, isAiError } from "../ai/errors.js";
import { DATA_RULE, fence } from "../ai/features/prompt.js";

export const INBOX_SORT = "inbox.sort";
const KIND = "inbox.scan";

const HARD_MESSAGE_CAP = 1500;
const PAGE_SIZE = 500;
const FETCH_CONCURRENCY = 8;
const BATCH_SIZE = 15;
const BATCH_CONCURRENCY = 4;
const BODY_KEEP_CHARS = 700;
const BODY_PER_MSG_CHARS = 600;
/** Leave this much of a step for the writes after the last round. */
const STEP_HEADROOM_MS = 55_000;

interface StoredMsg {
  id: string;
  threadId: string;
  from: string;
  fromDomain: string;
  subject: string;
  body: string;
  at: number;
}

interface ScanState {
  phase?: "list" | "fetch" | "classify" | "finalize";
  ids?: { id: string; threadId: string }[];
  cursor?: number;
  messages?: StoredMsg[];
  batchCursor?: number;
  results?: Record<string, Classification>;
}

const classificationSchema = z.object({
  results: z.array(z.object({
    threadId: z.string(),
    isJobApplication: z.boolean().describe("true only for a thread about an application the user submitted (job, internship, fellowship). Alerts, newsletters, marketing and networking are false."),
    company: z.string().nullable().describe("The employer — not an agency or job board. null if the thread doesn't say."),
    role: z.string().nullable().describe("The job title if the thread names it, else null."),
    stage: z.enum(STAGES as unknown as [Stage, ...Stage[]]).describe("From the LATEST message: Applied (acknowledged), OA (assessment sent), Interview (invited/scheduled/after), Offer, Rejected. Never Drafting."),
    confidence: z.enum(["low", "medium", "high"]),
  })),
});
type Classification = z.infer<typeof classificationSchema>["results"][number];

const SYSTEM = `You sort a person's email threads to find the job applications they submitted, and where each one stands.

Each thread is a chronological list of messages. For each thread return its threadId, whether it is about an application the person submitted, the employer and role when the thread states them (null otherwise — never guess), the stage shown by the LATEST message, and your confidence.

Return one result per thread, in the order given.

${DATA_RULE}`;

/* ---------------- Gmail ---------------- */

function gmailClient(refreshToken: string): gmail_v1.Gmail {
  const client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GMAIL_REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
}

function isAuthFailure(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string | number; message?: string };
  return e?.response?.status === 401 || e?.code === "invalid_grant" || /invalid_grant/i.test(e?.message ?? "");
}

async function disconnectExpired(userId: mongoose.Types.ObjectId) {
  await User.updateOne({ _id: userId }, { $set: { gmailConnected: false, gmailRefreshToken: null } });
  throw new UserFacingError("Gmail access has expired. Reconnect Gmail in Settings → Connectors, then scan again.");
}

function bodyOf(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const queue: gmail_v1.Schema$MessagePart[] = [payload];
  let html = "";
  while (queue.length) {
    const part = queue.shift()!;
    if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
    if (part.mimeType === "text/html" && part.body?.data && !html) html = Buffer.from(part.body.data, "base64url").toString("utf8");
    if (part.parts) queue.push(...part.parts);
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(id: string, threadId: string, msg: gmail_v1.Schema$Message): StoredMsg | null {
  const headers = msg.payload?.headers ?? [];
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
  if (!from || !subject) return null;
  const body = bodyOf(msg.payload ?? undefined).replace(/\s+/g, " ").trim();
  return {
    id,
    threadId,
    from,
    fromDomain: from.match(/@([a-zA-Z0-9.-]+)/)?.[1]?.toLowerCase() ?? "",
    subject,
    body: body.slice(0, BODY_KEEP_CHARS),
    at: msg.internalDate ? Number(msg.internalDate) : Date.now(),
  };
}

/** Drop newsletters and job-alert digests; keep ATS senders and application signals. */
function worthKeeping(m: StoredMsg): boolean {
  if (isLikelyNewsletter(m.from)) return false;
  if (hasNegativeSignal(m.subject, m.body)) return false;
  if (isAtsSender(m.fromDomain)) return true;
  return /apply|application|interview|recruit|offer|position|opportunity|candidacy|next steps|onboarding|hiring|assessment|coding challenge|thank you for|regret|unfortunately/i.test(
    `${m.subject}\n${m.body}`,
  );
}

function threadsOf(messages: StoredMsg[]): { threadId: string; messages: StoredMsg[] }[] {
  const buckets = new Map<string, StoredMsg[]>();
  for (const m of messages) buckets.set(m.threadId, [...(buckets.get(m.threadId) ?? []), m]);
  return [...buckets.entries()]
    .map(([threadId, msgs]) => ({ threadId, messages: msgs.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => b.messages[b.messages.length - 1].at - a.messages[a.messages.length - 1].at);
}

function serialise(thread: { threadId: string; messages: StoredMsg[] }): string {
  const lines = [`Thread: ${thread.threadId}`];
  thread.messages.forEach((m, i) => {
    lines.push(
      `--- ${i === thread.messages.length - 1 ? "LATEST" : `MSG ${i + 1}`} ---`,
      `From: ${m.from}`,
      `Subject: ${m.subject}`,
      `Date: ${new Date(m.at).toISOString()}`,
      `Body: ${m.body.slice(0, BODY_PER_MSG_CHARS)}`,
    );
  });
  return lines.join("\n");
}

/* ---------------- the step ---------------- */

async function scanStep(ctx: JobContext) {
  const scan = await EmailScanJob.findById(ctx.job.refId);
  if (!scan) return { done: true as const };
  if (scan.status === "failed" || scan.status === "completed" || scan.status === "ready_for_review") return { done: true as const };

  const user = await User.findById(scan.userId).select("gmailRefreshToken gmailConnected");
  if (!user?.gmailConnected || !user.gmailRefreshToken) {
    throw new UserFacingError("Gmail isn't connected. Connect it in Settings → Connectors, then scan again.");
  }
  let refreshToken: string;
  try {
    refreshToken = decrypt(user.gmailRefreshToken);
  } catch {
    throw new UserFacingError("The stored Gmail access couldn't be read. Reconnect Gmail in Settings → Connectors.");
  }
  const gmail = gmailClient(refreshToken);
  const state = (ctx.job.state ?? {}) as ScanState;
  const save = (next: ScanState) => ({ done: false as const, state: next as Record<string, unknown> });
  const timeLeft = () => ctx.remainingMs() > STEP_HEADROOM_MS;

  // 1. list
  if (!state.phase || state.phase === "list") {
    await setScan(scan, "scanning");
    const ids: { id: string; threadId: string }[] = [];
    const q = buildFirstScanQuery({ windowDays: scan.windowDays, afterEpochSec: scan.afterEpochSec });
    let pageToken: string | undefined;
    try {
      while (ids.length < HARD_MESSAGE_CAP) {
        const res = await gmail.users.messages.list({ userId: "me", q, maxResults: PAGE_SIZE, pageToken });
        for (const m of res.data.messages ?? []) {
          if (m.id && m.threadId) ids.push({ id: m.id, threadId: m.threadId });
          if (ids.length >= HARD_MESSAGE_CAP) break;
        }
        if (!res.data.nextPageToken) break;
        pageToken = res.data.nextPageToken;
      }
    } catch (err) {
      if (isAuthFailure(err)) await disconnectExpired(scan.userId);
      throw new UserFacingError("Gmail didn't answer while listing messages. Try the scan again in a minute.");
    }
    scan.progress.fetched = ids.length;
    await scan.save();
    await ctx.progress("Reading your inbox", 0, ids.length);
    state.phase = "fetch";
    state.ids = ids;
    state.cursor = 0;
    state.messages = [];
  }

  // 2. fetch + filter
  if (state.phase === "fetch") {
    const ids = state.ids ?? [];
    let cursor = state.cursor ?? 0;
    const kept = state.messages ?? [];
    while (cursor < ids.length) {
      if (!timeLeft()) return save({ ...state, cursor, messages: kept });
      const slice = ids.slice(cursor, cursor + FETCH_CONCURRENCY);
      const got = await Promise.allSettled(slice.map(({ id }) => gmail.users.messages.get({ userId: "me", id, format: "full" })));
      for (let j = 0; j < got.length; j++) {
        const r = got[j];
        if (r.status !== "fulfilled") {
          if (isAuthFailure(r.reason)) await disconnectExpired(scan.userId);
          continue;
        }
        const m = normalize(slice[j].id, slice[j].threadId, r.value.data);
        if (m && worthKeeping(m)) kept.push(m);
      }
      cursor += slice.length;
      if (cursor % (FETCH_CONCURRENCY * 10) === 0) await ctx.progress("Reading your inbox", cursor, ids.length);
    }
    await setScan(scan, "filtering");
    scan.progress.candidates = kept.length;
    scan.progress.threadGroups = threadsOf(kept).length;
    await scan.save();
    state.phase = "classify";
    state.ids = [];
    state.messages = kept;
    state.batchCursor = 0;
    state.results = {};
  }

  // 3. classify
  if (state.phase === "classify") {
    const threads = threadsOf(state.messages ?? []);
    const results = state.results ?? {};
    let batchCursor = state.batchCursor ?? 0;
    if (threads.length) await setScan(scan, "classifying");
    while (batchCursor < threads.length) {
      if (!timeLeft()) return save({ ...state, batchCursor, results });
      const round: { threadId: string; messages: StoredMsg[] }[][] = [];
      for (let k = 0; k < BATCH_CONCURRENCY && batchCursor + k * BATCH_SIZE < threads.length; k++) {
        round.push(threads.slice(batchCursor + k * BATCH_SIZE, batchCursor + (k + 1) * BATCH_SIZE));
      }
      const first = batchCursor === 0;
      const answers = await Promise.allSettled(
        round.map((batch, k) =>
          runAiObject(ctx.user, INBOX_SORT, {
            system: SYSTEM,
            prompt: batch.map((t) => fence("email", serialise(t))).join("\n\n"),
            schema: classificationSchema,
            jobId: ctx.job._id,
            countsAsUse: first && k === 0,
            budgetMs: Math.max(ctx.remainingMs() - 15_000, 5_000),
          }),
        ),
      );
      // A refusal (key gone, budget spent, feature switched off) ends the scan
      // in words; a batch lost to provider weather is skipped, not fatal.
      for (const a of answers) {
        if (a.status === "rejected" && isAiError(a.reason) && !["rate_limit", "provider_down", "timeout", "parse", "bad_request"].includes(a.reason.aiCode)) {
          throw a.reason;
        }
      }
      answers.forEach((a, k) => {
        if (a.status !== "fulfilled") {
          console.warn(`[inbox.scan] batch skipped:`, a.reason instanceof Error ? a.reason.message : a.reason);
          return;
        }
        const asked = new Set(round[k].map((t) => t.threadId));
        for (const r of a.value.data.results) if (asked.has(r.threadId)) results[r.threadId] = r;
      });
      batchCursor += round.reduce((n, b) => n + b.length, 0);
      scan.progress.classified = Math.min(batchCursor, threads.length);
      await scan.save();
      await ctx.progress("Sorting application emails", scan.progress.classified, threads.length);
    }
    state.phase = "finalize";
    state.batchCursor = batchCursor;
    state.results = results;
  }

  // 4. finalize → the review queue
  const threads = threadsOf(state.messages ?? []);
  const results = state.results ?? {};
  const existing = await Application.find({ userId: scan.userId }).select("_id company role applicationDate").lean();
  let emitted = 0;
  for (const thread of threads) {
    const cls = results[thread.threadId];
    const company = cls?.company?.trim();
    if (!cls?.isJobApplication || !company || cls.stage === "Drafting") continue;
    const latest = thread.messages[thread.messages.length - 1];
    const match = existing
      .filter((a) => (a.company ?? "").trim().toLowerCase() === company.toLowerCase())
      .sort((a, b) => (b.applicationDate?.getTime() ?? 0) - (a.applicationDate?.getTime() ?? 0))[0];
    await EmailScanCandidate.updateOne(
      { scanJobId: scan._id, threadId: thread.threadId },
      {
        $setOnInsert: {
          scanJobId: scan._id,
          userId: scan.userId,
          status: "pending",
          threadId: thread.threadId,
          company: company.slice(0, 200),
          role: (cls.role ?? "").trim().slice(0, 200),
          inferredStage: cls.stage,
          confidence: cls.confidence,
          earliestEmailDate: new Date(thread.messages[0]?.at ?? latest.at),
          latestEmailDate: new Date(latest.at),
          evidence: {
            from: latest.from,
            subject: latest.subject,
            snippet: latest.body.slice(0, 280),
            latestMessageId: latest.id,
            threadSize: thread.messages.length,
          },
          matchedApplicationId: match?._id ?? null,
        },
      },
      { upsert: true },
    );
    emitted++;
  }
  await finalizeScan(scan, emitted);
  return { done: true as const, result: { candidates: emitted } };
}

async function setScan(scan: IEmailScanJob, status: IEmailScanJob["status"]) {
  if (scan.status === status) return;
  scan.status = status;
  await scan.save();
}

async function finalizeScan(scan: IEmailScanJob, count: number) {
  scan.status = "ready_for_review";
  scan.counts.totalCandidates = count;
  scan.finishedAt = new Date();
  await scan.save();
  await User.updateOne(
    { _id: scan.userId },
    { $set: { gmailFirstScanCompleted: true, ...(scan.kind === "manual" ? { gmailLastSyncAt: new Date() } : {}) } },
  );
  await Notification.create({
    userId: scan.userId,
    type: "scan_ready",
    scanJobId: scan._id,
    title: count === 0 ? "Inbox scan finished" : `Inbox scan found ${count} application${count === 1 ? "" : "s"}`,
    message: count === 0
      ? "No application emails in the window you picked."
      : "Open the review queue to choose what to add to HireTrail.",
    source: "gmail",
  });
}

registerJobHandler(KIND, {
  feature: INBOX_SORT,
  run: scanStep,
  async onFail(job, failure) {
    await EmailScanJob.updateOne(
      { _id: job.refId, status: { $nin: ["ready_for_review", "completed"] } },
      { $set: { status: "failed", error: failure.message.slice(0, 500), finishedAt: new Date() } },
    );
  },
});

/* ---------------- starting, reaping ---------------- */

/** Refuse a scan up front, in words, when inbox sorting can't run for this user. */
export async function assertInboxSortAvailable(user: AiUser): Promise<void> {
  const decision = await laneFor(user, INBOX_SORT);
  if (decision.refusal) throw new AiError(decision.refusal.code, { feature: INBOX_SORT, featureLabel: "Sort inbox email", custom: decision.refusal.custom });
  if (decision.lane === "off") throw new AiError("off", { lane: "off", feature: INBOX_SORT, featureLabel: "Inbox sorting" });
}

export async function startInboxScan(scan: IEmailScanJob): Promise<void> {
  await startAiJob({
    userId: scan.userId,
    kind: KIND,
    refType: "emailScanJob",
    refId: scan._id,
    progressLabel: "Reading your inbox",
    maxAttempts: 3,
  });
}

/**
 * Scans from before the job engine (no AiJob behind them) can't resume; mark
 * the long-stuck ones failed so their spinner ends. Scans with a job behind
 * them are revived instead.
 */
export async function reapOrphanScans(): Promise<void> {
  const cutoff = new Date(Date.now() - 25 * 60_000);
  const stuck = await EmailScanJob.find({ status: { $in: ["pending", "scanning", "filtering", "classifying"] }, startedAt: { $lt: cutoff } })
    .select("_id")
    .lean();
  if (!stuck.length) return;
  const live = await AiJob.distinct("refId", {
    refType: "emailScanJob",
    refId: { $in: stuck.map((s) => s._id) },
    status: { $in: ["queued", "running"] },
  });
  const liveSet = new Set(live.map(String));
  const orphans = stuck.filter((s) => !liveSet.has(String(s._id))).map((s) => s._id);
  if (!orphans.length) return;
  await EmailScanJob.updateMany(
    { _id: { $in: orphans } },
    { $set: { status: "failed", error: "This scan was interrupted. Start a new one from Settings → Connectors.", finishedAt: new Date() } },
  );
}
