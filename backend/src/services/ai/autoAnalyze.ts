/**
 * Auto-analyze background worker — single canonical entry point used by both
 * the manual /tailor/analyze endpoint AND the new on-create trigger from
 * /applications POST.
 *
 * Guardrails baked in (see comments below):
 *   1. **Per-user concurrency cap (2 in flight)** + tiny FIFO queue so a CSV
 *      import of 200 jobs trickles through the LLM instead of fanning out.
 *   2. **Short-circuit when there's no master profile yet** — analysis is
 *      guaranteed to fail without one; don't burn API quota on certain-fails.
 *   3. **Per-user daily soft cap** — if a user has already triggered N analyses
 *      in the last 24h, newer ones get marked `status: "deferred"` instead of
 *      running. The frontend surfaces a "Analyze →" CTA so the user can opt-in
 *      after they've reviewed the earlier results.
 */
import mongoose from "mongoose";

import { analyzeJD } from "./tailor.js";
import { TailorSession } from "../../models/TailorSession.js";
import { Application } from "../../models/Application.js";
import { MasterProfile } from "../../models/MasterProfile.js";

// Raised from 2 → 5 (task 4): the central runner now enforces a per-user AI
// rate limit + monthly quota, so a higher analysis concurrency drains a CSV
// import / batch faster without risking a provider stampede.
const PER_USER_CONCURRENCY_CAP = 5;
const PER_USER_DAILY_CAP = 50;
const DAY_MS = 86_400_000;

/** In-process bookkeeping. Reset on server restart — that's fine, the daily
 *  cap is a "soft" cap counted by counting `TailorSession`s in Mongo too. */
const inFlightByUser = new Map<string, number>();
const queueByUser = new Map<string, Array<() => Promise<void>>>();

function key(userId: mongoose.Types.ObjectId | string) {
  return userId.toString();
}

function release(userId: mongoose.Types.ObjectId | string) {
  const k = key(userId);
  const n = (inFlightByUser.get(k) || 1) - 1;
  if (n <= 0) inFlightByUser.delete(k);
  else inFlightByUser.set(k, n);
  // Drain one queued task if available.
  const q = queueByUser.get(k);
  if (q && q.length > 0) {
    const next = q.shift()!;
    if (q.length === 0) queueByUser.delete(k);
    void runWithLease(userId, next);
  }
}

async function runWithLease(userId: mongoose.Types.ObjectId | string, task: () => Promise<void>) {
  const k = key(userId);
  const current = inFlightByUser.get(k) || 0;
  if (current >= PER_USER_CONCURRENCY_CAP) {
    const q = queueByUser.get(k) || [];
    q.push(task);
    queueByUser.set(k, q);
    return;
  }
  inFlightByUser.set(k, current + 1);
  try { await task(); } finally { release(userId); }
}

/** Count how many analyses this user has triggered in the last 24h. */
async function dailyAnalysesUsed(userId: mongoose.Types.ObjectId): Promise<number> {
  const since = new Date(Date.now() - DAY_MS);
  return TailorSession.countDocuments({ userId, createdAt: { $gte: since } });
}

export interface AnalyzeJobInput {
  applicationId?: mongoose.Types.ObjectId | null;
  jobTitle: string;
  company: string;
  url: string;
  jobDescription: string;
}

/** Run the LLM and write the result back to the session. Never throws.
 *  On failure, marks the session as `failed` with a short, user-readable
 *  `errorMessage`. The frontend reads that to decide whether to show a
 *  "Retry" CTA in the AI panel. */
function runAnalyzeWorker(
  sessionId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  jd: AnalyzeJobInput
): void {
  void runWithLease(userId, async () => {
    try {
      const { analysis, provider, modelId } = await analyzeJD(userId, jd);
      await TailorSession.findByIdAndUpdate(sessionId, {
        status: "succeeded",
        fitScore: analysis.fitScore,
        fitGrade: analysis.fitGrade,
        summary: analysis.summary,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
        suggestions: analysis.suggestions.map((s) => ({ ...s, decision: null })),
        provider,
        modelId,
      });
    } catch (err) {
      const e = err as { message?: string; status?: number; statusCode?: number };
      const status = e?.status ?? e?.statusCode;
      let msg: string;
      if (e?.message?.includes("No master profile")) {
        msg = "Set up your master profile to enable analysis.";
      } else if (status === 429 || /rate\s?limit/i.test(e?.message || "")) {
        msg = "AI provider rate limit hit — retry later.";
      } else if (status === 402 || /credit|quota|billing/i.test(e?.message || "")) {
        msg = "AI provider quota exhausted — add a BYOK key in Settings.";
      } else if (status === 401 || status === 403) {
        msg = "AI provider credentials invalid — check Settings.";
      } else {
        msg = e?.message || "Analysis failed.";
      }
      await TailorSession.findByIdAndUpdate(sessionId, { status: "failed", errorMessage: msg });
    }
  });
}

/** Public re-export so the existing /tailor/analyze route keeps a single
 *  source of truth for the worker implementation. */
export { runAnalyzeWorker };

/**
 * On-create entry point. Called from POST /api/applications after the 201 is
 * sent. Handles all the guardrails and either kicks off analysis, marks the
 * session `deferred`, or skips entirely. Never throws.
 */
export async function autoAnalyzeOnApplicationCreate(opts: {
  application: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; jobDescription?: string | null; role?: string; company?: string; jobUrl?: string; tailorSessionId?: mongoose.Types.ObjectId | null; source?: string };
}): Promise<void> {
  try {
    const app = opts.application;
    // Email-backfill imports never auto-analyze. They land without a JD and the
    // user opts into scoring later via the Tailor page (existing flow). The
    // structural bypass (backfill route uses Application.create directly, not
    // POST /api/applications) means we shouldn't reach here for these — this
    // is defence-in-depth so any future code path that does hit this function
    // can't accidentally fan out 50+ LLM calls for a fresh backfill.
    if (app.source === "email") return;
    const jd = (app.jobDescription || "").trim();
    if (jd.length < 200) return; // not enough signal to analyze
    if (app.tailorSessionId) return; // already linked (e.g. came from /tailor/init)

    // Short-circuit: no master profile means analysis would 100% fail.
    const hasProfile = await MasterProfile.exists({ userId: app.userId });
    if (!hasProfile) return;

    // Daily soft cap — over the line, create a "deferred" session and bail.
    const usedToday = await dailyAnalysesUsed(app.userId);
    const status: "processing" | "deferred" = usedToday >= PER_USER_DAILY_CAP ? "deferred" : "processing";

    const session = await TailorSession.create({
      userId: app.userId,
      applicationId: app._id,
      jobTitle: app.role || "",
      company: app.company || "",
      jobUrl: app.jobUrl || "",
      jobDescription: jd.slice(0, 30_000),
      status,
      errorMessage: status === "deferred" ? "Daily auto-analyze limit reached — click Analyze to run manually." : "",
      fitScore: 0,
      fitGrade: "",
      provider: "",
      modelId: "",
    });

    await Application.updateOne({ _id: app._id }, { $set: { tailorSessionId: session._id } });

    if (status === "processing") {
      runAnalyzeWorker(session._id, app.userId, {
        applicationId: app._id,
        jobTitle: app.role || "",
        company: app.company || "",
        url: app.jobUrl || "",
        jobDescription: jd,
      });
    }
  } catch (err) {
    console.warn("[autoAnalyzeOnApplicationCreate]", err instanceof Error ? err.message : err);
  }
}
