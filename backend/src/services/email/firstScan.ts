/**
 * First-scan backfill worker.
 *
 * Started by the route handler via `kickoffFirstScan(jobId)`, which returns
 * immediately and lets the worker run via `setImmediate`. The HTTP response
 * goes back to the client right away; the worker progresses the EmailScanJob
 * document through its statuses while the user goes on with their day. The
 * frontend polls the job and shows the review queue when it's ready.
 *
 * Pipeline:
 *   1. Build the optimized Gmail q: (subject keywords + category:primary)
 *   2. Paginate messages.list, capping at HARD_MESSAGE_CAP
 *   3. Fetch each message, drop newsletters, keep ATS senders or
 *      keyword-matching subjects
 *   4. Group by Gmail threadId
 *   5. Batched LLM classify each thread
 *   6. Dedupe against existing user apps and write EmailScanCandidate docs
 *   7. Update status → ready_for_review, push a Notification
 *
 * Any throw inside the worker is caught and recorded on the job — the user
 * sees a clear error in the review surface and can retry. The reaper at
 * startup also rescues jobs orphaned by a server restart.
 */
import { google, gmail_v1 } from "googleapis";

import { env } from "../../config/env.js";
import { decrypt } from "../../utils/encryption.js";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Notification } from "../../models/Notification.js";
import { EmailScanJob, type IEmailScanJob } from "../../models/EmailScanJob.js";
import { EmailScanCandidate } from "../../models/EmailScanCandidate.js";
import { buildFirstScanQuery } from "./firstScanQuery.js";
import { isAtsSender, isLikelyNewsletter, hasNegativeSignal } from "./atsDomains.js";
import {
  classifyThreadsInBatches,
  type BatchEmailMessage,
  type BatchThread,
} from "./batchClassify.js";

/** Upper bound to keep a single scan bounded even on heavy inboxes. The
 *  optimized Gmail query keeps real returns well under this. */
const HARD_MESSAGE_CAP = 1500;
/** Gmail API pagination size — `messages.list` accepts up to 500. */
const PAGE_SIZE = 500;
/** Worker is considered abandoned after this many minutes in a non-terminal
 *  status. Used by the reaper after a server restart. */
const REAPER_STALE_MINUTES = 25;

/* -------------------- entry points -------------------- */

/**
 * Fire-and-forget. Returns immediately. Caller is responsible for having
 * persisted the EmailScanJob with status="pending" first.
 */
export function kickoffFirstScan(jobId: string): void {
  setImmediate(() => {
    runFirstScan(jobId).catch((err) => {
      console.error(`[firstScan] uncaught in worker for job ${jobId}:`, err);
      void EmailScanJob.findByIdAndUpdate(jobId, {
        status: "failed",
        error: (err as Error)?.message?.slice(0, 500) ?? "Unknown error",
        finishedAt: new Date(),
      });
    });
  });
}

/** Mark any in-flight scan jobs older than the threshold as failed.
 *  Called at server startup so a restart mid-scan doesn't leave jobs
 *  spinning forever from the user's POV. */
export async function reapStalledScanJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - REAPER_STALE_MINUTES * 60 * 1000);
  await EmailScanJob.updateMany(
    {
      status: { $in: ["pending", "scanning", "filtering", "classifying"] },
      startedAt: { $lt: cutoff },
    },
    {
      $set: {
        status: "failed",
        error: "Scan was interrupted by a server restart. Please retry from Settings → Email.",
        finishedAt: new Date(),
      },
    },
  );
}

/* -------------------- worker -------------------- */

async function runFirstScan(jobId: string): Promise<void> {
  const job = await EmailScanJob.findById(jobId);
  if (!job) {
    console.warn(`[firstScan] no job found for id ${jobId}`);
    return;
  }
  if (job.status !== "pending") {
    console.warn(`[firstScan] job ${jobId} already in status ${job.status}; skipping`);
    return;
  }

  const user = await User.findById(job.userId);
  if (!user || !user.gmailRefreshToken || !user.gmailConnected) {
    await failJob(job, "Gmail is not connected. Reconnect and start a new scan.");
    return;
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(user.gmailRefreshToken);
  } catch {
    await failJob(job, "Could not decrypt the stored Gmail token. Please reconnect Gmail.");
    return;
  }

  const gmail = makeGmailClient(refreshToken);

  /* -- fetch phase -- */
  await advanceStatus(job, "scanning");
  const messages = await fetchFilteredMessages(gmail, job, user._id.toString());
  if (!messages) return; // failJob already called

  /* -- filter phase -- */
  await advanceStatus(job, "filtering");
  const filtered = messages.filter(passesPostFetchFilter);
  job.progress.candidates = filtered.length;
  await job.save();

  /* -- thread grouping -- */
  const threads = groupIntoThreads(filtered);
  job.progress.threadGroups = threads.length;
  await job.save();

  if (threads.length === 0) {
    await finalizeJob(job, 0);
    return;
  }

  /* -- classify phase -- */
  await advanceStatus(job, "classifying");
  const classifications = await classifyThreadsInBatches(
    user._id,
    threads,
    async (count) => {
      job.progress.classified = count;
      await job.save();
    },
  );

  /* -- dedupe + persist candidates -- */
  const existingApps = await Application.find({ userId: user._id })
    .select("_id company role applicationDate")
    .lean();

  let emitted = 0;
  for (let i = 0; i < threads.length; i++) {
    const cls = classifications[i];
    const thread = threads[i];
    if (!cls || !cls.isJobApplication) continue;
    if (!cls.company.trim()) continue; // unknown company → can't import meaningfully

    const latest = thread.messages[thread.messages.length - 1];
    const earliestDate = thread.messages[0]?.internalDate ?? latest.internalDate;
    const matched = findExistingMatch(existingApps, cls.company, cls.role);

    await EmailScanCandidate.create({
      scanJobId: job._id,
      userId: user._id,
      status: "pending",
      threadId: thread.threadId,
      company: cls.company.trim().slice(0, 200),
      role: (cls.role || "").trim().slice(0, 200),
      inferredStage: cls.stage,
      confidence: cls.confidence,
      earliestEmailDate: earliestDate,
      latestEmailDate: latest.internalDate,
      evidence: {
        from: latest.from,
        subject: latest.subject,
        snippet: latest.bodyText.replace(/\s+/g, " ").slice(0, 280),
        latestMessageId: latest.id,
        threadSize: thread.messages.length,
      },
      matchedApplicationId: matched?._id ?? null,
    });
    emitted++;
  }

  await finalizeJob(job, emitted);
}

/* -------------------- helpers -------------------- */

function makeGmailClient(refreshToken: string): gmail_v1.Gmail {
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GMAIL_REDIRECT_URI,
  );
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
}

interface FetchedMessage {
  id: string;
  threadId: string;
  from: string;
  fromDomain: string;
  subject: string;
  bodyText: string;
  internalDate: Date;
}

/** Page through messages.list with the optimized query and fetch each one's
 *  body. Returns null if a token/permission error occurs (the job is failed). */
async function fetchFilteredMessages(
  gmail: gmail_v1.Gmail,
  job: IEmailScanJob,
  userId: string,
): Promise<FetchedMessage[] | null> {
  const q = buildFirstScanQuery({ windowDays: job.windowDays, afterEpochSec: job.afterEpochSec });
  const idsAndThreads: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  try {
    while (idsAndThreads.length < HARD_MESSAGE_CAP) {
      const res = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: PAGE_SIZE,
        pageToken,
      });
      const batch = res.data.messages ?? [];
      for (const m of batch) {
        if (m.id && m.threadId) idsAndThreads.push({ id: m.id, threadId: m.threadId });
        if (idsAndThreads.length >= HARD_MESSAGE_CAP) break;
      }
      if (!res.data.nextPageToken) break;
      pageToken = res.data.nextPageToken;
    }
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; code?: string };
    if (e.response?.status === 401 || e.code === "invalid_grant") {
      await User.findByIdAndUpdate(userId, { gmailConnected: false, gmailRefreshToken: null });
      await failJob(job, "Your Gmail token expired. Reconnect Gmail and start a new scan.");
      return null;
    }
    await failJob(job, `Gmail listing failed: ${(err as Error)?.message?.slice(0, 200) ?? "unknown"}`);
    return null;
  }

  job.progress.fetched = idsAndThreads.length;
  await job.save();

  // Fetch full bodies, modest concurrency to avoid Gmail throttling.
  const fetched: FetchedMessage[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < idsAndThreads.length; i += CONCURRENCY) {
    const slice = idsAndThreads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map(({ id }) => gmail.users.messages.get({ userId: "me", id, format: "full" })),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status !== "fulfilled") continue;
      const m = normalizeMessage(slice[j].id, slice[j].threadId, r.value.data);
      if (m) fetched.push(m);
    }
  }
  return fetched;
}

function normalizeMessage(
  id: string,
  threadId: string,
  msg: gmail_v1.Schema$Message,
): FetchedMessage | null {
  const headers = msg.payload?.headers ?? [];
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
  if (!from || !subject) return null;

  const fromDomain = from.match(/@([a-zA-Z0-9.-]+)/)?.[1]?.toLowerCase() ?? "";
  const bodyText = extractBody(msg.payload ?? undefined);
  const internalDate = msg.internalDate
    ? new Date(Number(msg.internalDate))
    : new Date();

  return { id, threadId, from, fromDomain, subject, bodyText, internalDate };
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const queue: gmail_v1.Schema$MessagePart[] = [payload];
  let htmlFallback = "";
  while (queue.length) {
    const part = queue.shift()!;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.mimeType === "text/html" && part.body?.data && !htmlFallback) {
      htmlFallback = Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.parts) queue.push(...part.parts);
  }
  return htmlFallback.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Post-fetch sieve. ATS senders pass automatically. Otherwise the message
 *  has to match a broader keyword check on subject + body head, since the
 *  Gmail-side query already narrowed to "subject contains [list]" — anything
 *  here passed that bar and we mainly want to drop newsletters. */
function passesPostFetchFilter(m: FetchedMessage): boolean {
  if (isLikelyNewsletter(m.from)) return false;
  const bodyHead = m.bodyText.slice(0, 1500);
  // Negative keywords drop job-board ALERTS/marketing even from ATS senders
  // (LinkedIn/Indeed send both receipts and "12 new jobs for you" digests).
  if (hasNegativeSignal(m.subject, bodyHead)) return false;
  if (isAtsSender(m.fromDomain)) return true;
  // Subject already passed Gmail's filter; require any of these signals in
  // subject OR first chunk of body to weed out near-misses.
  const haystack = `${m.subject}\n${bodyHead}`;
  return /apply|application|interview|recruit|offer|position|opportunity|candidacy|next steps|onboarding|hiring|assessment|coding challenge|thank you for|regret|unfortunately/i.test(
    haystack,
  );
}

/** Bucket messages by Gmail threadId. Each bucket's messages are returned
 *  in chronological order so the LLM sees history-then-latest. */
function groupIntoThreads(messages: FetchedMessage[]): BatchThread[] {
  const buckets = new Map<string, FetchedMessage[]>();
  for (const m of messages) {
    const arr = buckets.get(m.threadId) ?? [];
    arr.push(m);
    buckets.set(m.threadId, arr);
  }
  const threads: BatchThread[] = [];
  for (const [threadId, arr] of buckets) {
    arr.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
    const batchMessages: BatchEmailMessage[] = arr.map((m) => ({
      id: m.id,
      from: m.from,
      fromDomain: m.fromDomain,
      subject: m.subject,
      bodyText: m.bodyText,
      internalDate: m.internalDate,
    }));
    threads.push({ threadId, messages: batchMessages });
  }
  // Latest activity first, so when totals are capped the most relevant survive.
  threads.sort(
    (a, b) =>
      b.messages[b.messages.length - 1].internalDate.getTime() -
      a.messages[a.messages.length - 1].internalDate.getTime(),
  );
  return threads;
}

interface AppRow {
  _id: { toString(): string };
  company?: string;
  role?: string;
  applicationDate?: Date;
}

/** Find an existing application by case-insensitive company match. If multiple
 *  apps share the company name (e.g. user applied to two roles at Stripe), we
 *  return the most-recent — the UI will offer Merge or Skip on top of that. */
function findExistingMatch(apps: AppRow[], company: string, _role: string): AppRow | null {
  const target = company.trim().toLowerCase();
  if (!target) return null;
  const matches = apps.filter((a) => (a.company ?? "").trim().toLowerCase() === target);
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ad = a.applicationDate ? a.applicationDate.getTime() : 0;
    const bd = b.applicationDate ? b.applicationDate.getTime() : 0;
    return bd - ad;
  });
  return matches[0];
}

/* -------------------- status transitions -------------------- */

async function advanceStatus(job: IEmailScanJob, status: IEmailScanJob["status"]): Promise<void> {
  job.status = status;
  await job.save();
}

async function failJob(job: IEmailScanJob, message: string): Promise<void> {
  job.status = "failed";
  job.error = message.slice(0, 500);
  job.finishedAt = new Date();
  await job.save();
}

async function finalizeJob(job: IEmailScanJob, candidateCount: number): Promise<void> {
  job.status = "ready_for_review";
  job.counts.totalCandidates = candidateCount;
  job.finishedAt = new Date();
  await job.save();

  // Now (and only now) flip firstScanCompleted on the User. The picker stays
  // available until the scan actually succeeds — multiple failed attempts no
  // longer lock the user out. Manual "Scan now" runs also bump the last-sync
  // timestamp so the mailbox card reflects the fresh read.
  await User.findByIdAndUpdate(job.userId, {
    gmailFirstScanCompleted: true,
    ...(job.kind === "manual" ? { gmailLastSyncAt: new Date() } : {}),
  });

  // Push a notification so the bell badge increments — user sees the prompt
  // even if they navigated away from Settings.
  await Notification.create({
    userId: job.userId,
    type: "scan_ready",
    scanJobId: job._id,
    title:
      candidateCount === 0
        ? "Inbox scan finished"
        : `Inbox scan found ${candidateCount} application${candidateCount === 1 ? "" : "s"}`,
    message:
      candidateCount === 0
        ? "We didn't find any application emails in the window you picked. You can re-scan from Settings → Email."
        : "Open the review queue to import them into HireTrail.",
    source: "gmail",
  });
}
