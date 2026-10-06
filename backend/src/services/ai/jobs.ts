/**
 * AI jobs — AI work that outlives the request that asked for it.
 *
 *   startAiJob   — writes the job row, then runs it under `waitUntil` so the
 *                  response goes out at once and Vercel keeps the function
 *                  alive until the step settles.
 *   a step       — one claim of the job: the handler gets a hard deadline
 *                  (well under the host's 300 s) and returns either "done" or
 *                  "more" with its resumable state. "More" puts the job back in
 *                  the queue and asks a fresh invocation to continue it, so a
 *                  long scan is many short steps instead of one long timeout.
 *   revive       — status reads call `reviveAiJobs(userId)`: a queued job no
 *                  one is running, or a running one whose lease ran out (the
 *                  instance died), is claimed again. The UI polls while work is
 *                  in flight, so a lost continuation costs seconds, not a job.
 *   assistant    — when the feature runs in the user's assistant, the gateway
 *                  refuses with `assistant_lane` and the job parks in
 *                  `waiting_assistant` until an MCP client claims and submits it.
 *
 * Handlers own their resource (a TailorSession, the master profile, a scan):
 * they write progress and results there, so every existing screen keeps
 * reading the row it always read. The job row is the engine, not the UI.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { waitUntil } from "@vercel/functions";
import type { z } from "zod";

import { AiJob, type IAiJob } from "../../models/AiJob.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { AiError, aiErrorMessage, isAiError, TRANSIENT_CODES, type AiErrorCode } from "./errors.js";
import { loadAiUser, type AiUser } from "./gateway.js";
import { aiFeature } from "./registry.js";

/** One step's wall-clock budget: 70% of the host's function limit (at most
 *  200 s), the rest headroom for the claim, the writes and a slow Mongo. */
const STEP_BUDGET_MS = Math.min(200_000, Math.floor(env.FUNCTION_MAX_DURATION_S * 1000 * 0.7));
/** A lease outlives its step by this much before anyone may take it over. */
const LEASE_GRACE_MS = 30_000;
/** How long an assistant holds a claimed job before it goes back to waiting. */
const ASSISTANT_LEASE_MS = 15 * 60_000;
/** Wait before retrying a job that failed on provider weather. */
const RETRY_DELAY_MS = 20_000;

export interface JobContext {
  job: IAiJob;
  user: AiUser;
  /** Epoch ms the step must finish by. */
  deadline: number;
  remainingMs(): number;
  progress(label: string, done?: number, total?: number): Promise<void>;
}

export type StepOutcome =
  | { done: true; result?: Record<string, unknown> }
  | { done: false; state: Record<string, unknown> };

export interface JobHandler {
  feature: string;
  run(ctx: JobContext): Promise<StepOutcome>;
  /** Terminal failure or refusal: mark the resource. `code` is the AI error
   *  code when there is one ("off", "needs_key", "timeout", …); `lane` is
   *  where the call ran, when it got that far. */
  onFail(job: IAiJob, failure: JobFailure): Promise<void>;
  /** The job now waits for the user's assistant: mark the resource. */
  onWaitingAssistant?(job: IAiJob): Promise<void>;
  /** What the assistant is asked to do (MCP), and how its answer is applied. */
  assistant?: {
    brief(job: IAiJob): Promise<{ instructions: string; context: Record<string, unknown> }>;
    schema: z.ZodTypeAny;
    apply(job: IAiJob, answer: unknown): Promise<Record<string, unknown> | void>;
  };
}

export interface JobFailure {
  code: AiErrorCode | "internal";
  message: string;
  lane?: string;
}

const HANDLERS = new Map<string, JobHandler>();

/** A settled job keeps its outcome, not its working material: the posting,
 *  resume text or email slices it carried are dropped when it settles. */
const CLEARED = { input: {}, state: {} };

/** Feature modules register their handlers at import time. */
export function registerJobHandler(kind: string, handler: JobHandler): void {
  aiFeature(handler.feature); // an unregistered feature is a programming error
  HANDLERS.set(kind, handler);
}

export function jobHandler(kind: string): JobHandler | undefined {
  return HANDLERS.get(kind);
}

/* ---------------- starting ---------------- */

export interface StartJobInput {
  userId: mongoose.Types.ObjectId;
  kind: string;
  input?: Record<string, unknown>;
  refType?: string | null;
  refId?: mongoose.Types.ObjectId | null;
  progressLabel?: string;
  maxAttempts?: number;
}

export async function startAiJob(opts: StartJobInput): Promise<IAiJob> {
  const handler = HANDLERS.get(opts.kind);
  if (!handler) throw new Error(`[ai-jobs] no handler registered for '${opts.kind}'`);
  const job = await AiJob.create({
    userId: opts.userId,
    feature: handler.feature,
    kind: opts.kind,
    status: "queued",
    input: opts.input ?? {},
    refType: opts.refType ?? null,
    refId: opts.refId ?? null,
    progress: { label: opts.progressLabel ?? "Queued", done: 0, total: 0 },
    maxAttempts: opts.maxAttempts ?? 3,
  });
  kick(job._id);
  return job;
}

/** Run a job's next step in the background of the current invocation. */
function kick(jobId: mongoose.Types.ObjectId | string): void {
  waitUntil(
    runStep(jobId.toString()).catch((err) => {
      console.error(`[ai-jobs] step for ${jobId} crashed:`, err);
    }),
  );
}

/* ---------------- running ---------------- */

async function claim(jobId: string): Promise<IAiJob | null> {
  const now = new Date();
  return AiJob.findOneAndUpdate(
    {
      _id: jobId,
      $or: [
        { status: "queued", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] },
        { status: "running", leaseHolder: "server", leaseUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: "running",
        leaseHolder: "server",
        leaseUntil: new Date(now.getTime() + STEP_BUDGET_MS + LEASE_GRACE_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
}

async function runStep(jobId: string): Promise<void> {
  const job = await claim(jobId);
  if (!job) return; // someone else has it, or it already settled
  if (!job.startedAt) {
    job.startedAt = new Date();
    await AiJob.updateOne({ _id: job._id }, { $set: { startedAt: job.startedAt } });
  }
  const handler = HANDLERS.get(job.kind);
  if (!handler) {
    await settleFailed(job, null, { code: "internal", message: "This kind of AI work is no longer supported." });
    return;
  }
  if (job.attempts > job.maxAttempts) {
    await settleFailed(job, handler, { code: "timeout", message: aiErrorMessage("timeout") });
    return;
  }

  const started = Date.now();
  const deadline = started + STEP_BUDGET_MS;
  let outcome: StepOutcome;
  try {
    const user = await loadAiUser(job.userId);
    outcome = await handler.run({
      job,
      user,
      deadline,
      remainingMs: () => deadline - Date.now(),
      progress: async (label, done = 0, total = 0) => {
        job.progress = { label, done, total };
        await AiJob.updateOne(
          { _id: job._id, status: "running" },
          {
            $set: {
              progress: job.progress,
              // A progress write doubles as a heartbeat.
              leaseUntil: new Date(Date.now() + Math.max(deadline - Date.now(), 0) + LEASE_GRACE_MS),
            },
          },
        );
      },
    });
  } catch (err) {
    // A job cancelled while its step ran stays cancelled.
    const live = await AiJob.findById(job._id).select("status").lean();
    if (live?.status === "running") await handleThrow(job, handler, err);
    return;
  }

  // The user may have cancelled while the step ran — drop its outcome.
  const live = await AiJob.findById(job._id).select("status").lean();
  if (!live || live.status !== "running") return;

  if (outcome.done) {
    await AiJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "succeeded",
          result: outcome.result ?? {},
          error: null,
          leaseUntil: null,
          leaseHolder: null,
          finishedAt: new Date(),
          ...CLEARED,
        },
      },
    );
    return;
  }

  // More to do: save the cursor, reset the no-progress counter, continue.
  await AiJob.updateOne(
    { _id: job._id },
    { $set: { status: "queued", state: outcome.state, attempts: 0, leaseUntil: null, leaseHolder: null } },
  );
  continueSoon(job._id.toString());
}

async function handleThrow(job: IAiJob, handler: JobHandler, err: unknown): Promise<void> {
  if (isAiError(err)) {
    if (err.aiCode === "assistant_lane" && handler.assistant) {
      await AiJob.updateOne(
        { _id: job._id },
        { $set: { status: "waiting_assistant", leaseUntil: null, leaseHolder: null, progress: { label: "Waiting for your assistant", done: 0, total: 0 } } },
      );
      await handler.onWaitingAssistant?.(job);
      return;
    }
    // Provider weather: try again shortly, while attempts remain.
    if ((TRANSIENT_CODES.includes(err.aiCode) || err.aiCode === "timeout") && job.attempts < job.maxAttempts) {
      await AiJob.updateOne(
        { _id: job._id },
        { $set: { status: "queued", leaseUntil: new Date(Date.now() + RETRY_DELAY_MS), leaseHolder: null } },
      );
      // On Vercel the next status read revives it; a long-lived process just waits.
      if (!process.env.VERCEL) setTimeout(() => kick(job._id), RETRY_DELAY_MS + 500).unref();
      return;
    }
    await settleFailed(job, handler, { code: err.aiCode, message: err.message, lane: err.lane });
    return;
  }
  console.error(`[ai-jobs] ${job.kind} ${job._id} failed:`, err);
  const message = err instanceof Error && err.name === "UserFacingError" ? err.message : "Something went wrong on our side. Try again.";
  await settleFailed(job, handler, { code: "internal", message });
}

async function settleFailed(job: IAiJob, handler: JobHandler | null, failure: JobFailure): Promise<void> {
  await AiJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: failure.code === "off" ? "cancelled" : "failed",
        error: { code: failure.code, message: failure.message },
        leaseUntil: null,
        leaseHolder: null,
        finishedAt: new Date(),
        ...CLEARED,
      },
    },
  );
  try {
    await handler?.onFail(job, failure);
  } catch (err) {
    console.error(`[ai-jobs] onFail for ${job.kind} ${job._id} threw:`, err);
  }
}

/**
 * A plain sentence a handler may throw for a condition the person can act on
 * ("This PDF is a scan…"). Anything else thrown reads as our fault.
 */
export class UserFacingError extends AppError {
  constructor(message: string) {
    super(message, 422, { code: "ai_input" });
    this.name = "UserFacingError";
  }
}

/* ---------------- continuing ---------------- */

function continueSecret(): Buffer {
  return crypto.createHash("sha256").update(`${env.SESSION_SECRET}:ai-jobs`).digest();
}

export function continueSignature(jobId: string): string {
  return crypto.createHmac("sha256", continueSecret()).update(jobId).digest("hex");
}

export function verifyContinueSignature(jobId: string, sig: string): boolean {
  const want = Buffer.from(continueSignature(jobId), "hex");
  const got = Buffer.from(sig || "", "hex");
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** The API's own public origin, for self-continuation on Vercel. */
function selfOrigin(): string | null {
  if (env.API_PUBLIC_URL) return env.API_PUBLIC_URL.replace(/\/+$/, "");
  try {
    return new URL(env.GOOGLE_CALLBACK_URL).origin;
  } catch {
    return null;
  }
}

/**
 * Ask a fresh invocation to run the next step. In a long-lived process (local
 * dev) that's just the next tick; on Vercel it's a signed call to our own
 * internal endpoint, so the new step gets a full time budget of its own. If
 * the call is lost, the next status read revives the job.
 */
function continueSoon(jobId: string): void {
  const origin = process.env.VERCEL ? selfOrigin() : null;
  if (!origin) {
    setImmediate(() => kick(jobId));
    return;
  }
  waitUntil(
    fetch(`${origin}/api/internal/ai-jobs/${jobId}/continue`, {
      method: "POST",
      headers: { "x-hiretrail-job-signature": continueSignature(jobId) },
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => {
        if (!r.ok) console.warn(`[ai-jobs] continue for ${jobId} answered ${r.status}`);
      })
      .catch((err) => console.warn(`[ai-jobs] continue for ${jobId} failed:`, err instanceof Error ? err.message : err)),
  );
}

/** The internal endpoint's body: claim and run the next step here. */
export function continueAiJob(jobId: string): void {
  kick(jobId);
}

/* ---------------- reviving, reading, cancelling ---------------- */

/**
 * Pick up this user's stalled jobs. Cheap (one indexed query) and safe to call
 * on every status read: claiming is atomic, so two readers can't double-run.
 */
export async function reviveAiJobs(userId: mongoose.Types.ObjectId): Promise<void> {
  const now = new Date();
  const stalled = await AiJob.find({
    userId,
    $or: [
      { status: "queued", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }], updatedAt: { $lt: new Date(now.getTime() - 5_000) } },
      { status: "running", leaseUntil: { $lt: now } },
    ],
  })
    .select("_id status leaseHolder")
    .limit(10)
    .lean();
  for (const j of stalled) {
    if (j.status === "running" && j.leaseHolder?.startsWith("mcp:")) {
      // The assistant claimed it and went quiet — offer it again.
      await AiJob.updateOne(
        { _id: j._id, status: "running", leaseUntil: { $lt: now } },
        { $set: { status: "waiting_assistant", leaseUntil: null, leaseHolder: null } },
      );
      continue;
    }
    kick(j._id);
  }
}

/** The latest job for a resource, for status reads. */
export async function latestJobFor(refType: string, refId: mongoose.Types.ObjectId, kind?: string): Promise<IAiJob | null> {
  return AiJob.findOne({ refType, refId, ...(kind ? { kind } : {}) }).sort({ createdAt: -1 });
}

/** Is there live work on this resource (so a second request shouldn't start more)? */
export async function hasLiveJob(refType: string, refId: mongoose.Types.ObjectId, kind: string): Promise<boolean> {
  return Boolean(
    await AiJob.exists({ refType, refId, kind, status: { $in: ["queued", "running", "waiting_assistant"] } }),
  );
}

export async function cancelAiJob(jobId: string, userId: mongoose.Types.ObjectId): Promise<boolean> {
  if (!mongoose.isValidObjectId(jobId)) return false;
  const job = await AiJob.findOneAndUpdate(
    { _id: jobId, userId, status: { $in: ["queued", "running", "waiting_assistant"] } },
    { $set: { status: "cancelled", leaseUntil: null, leaseHolder: null, finishedAt: new Date(), error: { code: "aborted", message: "Stopped." }, ...CLEARED } },
    { new: true },
  );
  if (!job) return false;
  await HANDLERS.get(job.kind)?.onFail(job, { code: "aborted", message: "Stopped." }).catch(() => undefined);
  return true;
}

/** Cancel live work on a resource that is being replaced (a re-run). */
export async function cancelJobsFor(refType: string, refId: mongoose.Types.ObjectId, kind: string): Promise<void> {
  await AiJob.updateMany(
    { refType, refId, kind, status: { $in: ["queued", "running", "waiting_assistant"] } },
    { $set: { status: "cancelled", leaseUntil: null, leaseHolder: null, finishedAt: new Date(), error: { code: "aborted", message: "Replaced by a newer run." }, ...CLEARED } },
  );
}

/** A job as the client sees it. */
export function jobView(job: Pick<IAiJob, "_id" | "feature" | "kind" | "status" | "progress" | "error" | "result" | "refType" | "refId" | "createdAt" | "finishedAt">) {
  return {
    id: job._id.toString(),
    feature: job.feature,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    error: job.error,
    result: job.status === "succeeded" ? job.result : null,
    refType: job.refType,
    refId: job.refId?.toString() ?? null,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

/* ---------------- the assistant (MCP) side ---------------- */

/** Jobs waiting for this user's assistant, oldest first. */
export async function assistantQueue(userId: mongoose.Types.ObjectId, limit = 10): Promise<IAiJob[]> {
  return AiJob.find({ userId, status: "waiting_assistant" }).sort({ createdAt: 1 }).limit(limit);
}

/** Claim one waiting job for an assistant; returns its brief. */
export async function claimForAssistant(userId: mongoose.Types.ObjectId, jobId: string, holder: string) {
  if (!mongoose.isValidObjectId(jobId)) throw new AiError("not_allowed", { custom: "No such AI task." });
  const job = await AiJob.findOneAndUpdate(
    { _id: jobId, userId, status: "waiting_assistant" },
    { $set: { status: "running", leaseHolder: holder, leaseUntil: new Date(Date.now() + ASSISTANT_LEASE_MS), progress: { label: "Your assistant is working on it", done: 0, total: 0 } } },
    { new: true },
  );
  if (!job) throw new AiError("not_allowed", { custom: "That AI task isn't waiting for an assistant any more (it may be done or claimed)." });
  const handler = HANDLERS.get(job.kind);
  if (!handler?.assistant) throw new AiError("unsupported", { custom: "This AI task can't be done by an assistant." });
  const brief = await handler.assistant.brief(job);
  return { job, brief, schema: handler.assistant.schema };
}

/** Apply an assistant's answer. Validation failures leave the claim in place
 *  so the assistant can fix its answer and submit again. */
export async function submitFromAssistant(userId: mongoose.Types.ObjectId, jobId: string, holder: string, answer: unknown) {
  if (!mongoose.isValidObjectId(jobId)) throw new AiError("not_allowed", { custom: "No such AI task." });
  const job = await AiJob.findOne({ _id: jobId, userId, status: "running", leaseHolder: holder });
  if (!job) throw new AiError("not_allowed", { custom: "Claim this AI task before submitting it (claims last 15 minutes)." });
  const handler = HANDLERS.get(job.kind);
  if (!handler?.assistant) throw new AiError("unsupported", { custom: "This AI task can't be done by an assistant." });
  const parsed = handler.assistant.schema.safeParse(answer);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new AiError("parse", { custom: `That answer doesn't match the expected shape — ${issues}` });
  }
  const result = (await handler.assistant.apply(job, parsed.data)) ?? {};
  await AiJob.updateOne(
    { _id: job._id },
    { $set: { status: "succeeded", result, error: null, leaseUntil: null, leaseHolder: null, finishedAt: new Date(), ...CLEARED } },
  );
  return result;
}
