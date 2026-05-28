/**
 * Unified email integration routes — Gmail + Outlook.
 *
 *   /api/email/status                  → combined status for both providers
 *   /api/email/scan                    → scan whichever providers are connected
 *   /api/email/gmail/{connect,scan,disconnect,callback}
 *   /api/email/outlook/{connect,scan,disconnect,callback}
 */
import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { User } from "../models/User.js";
import { Application, STAGES, type Stage } from "../models/Application.js";
import { EmailScanJob, SCAN_WINDOW_DAYS, type ScanWindowDays } from "../models/EmailScanJob.js";
import { EmailScanCandidate } from "../models/EmailScanCandidate.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { kickoffFirstScan } from "../services/email/firstScan.js";
import * as gmail from "../services/gmailService.js";
import * as outlook from "../services/outlookService.js";

/** Consent string is versioned so a future scope expansion can re-prompt. */
const SCAN_CONSENT_SCOPE_V1 = "gmail.readonly_backfill_v1";

const router = Router();

/* ------------------ OAuth callbacks (no auth — redirect targets) ------------------ */

router.get("/callback", async (req: Request, res: Response) => {
  // Legacy Gmail callback path, kept for installed-app compat.
  return handleGmailCallback(req, res);
});

router.get("/gmail/callback", async (req: Request, res: Response) => {
  return handleGmailCallback(req, res);
});

async function handleGmailCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.redirect(`${env.CLIENT_URL}/settings?gmail=error`);
    await gmail.handleCallback(code, state);
    res.redirect(`${env.CLIENT_URL}/settings?gmail=success`);
  } catch (err) {
    console.error("[Gmail] Callback error:", err);
    res.redirect(`${env.CLIENT_URL}/settings?gmail=error`);
  }
}

router.get("/outlook/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.redirect(`${env.CLIENT_URL}/settings?outlook=error`);
    await outlook.handleCallback(code, state);
    res.redirect(`${env.CLIENT_URL}/settings?outlook=success`);
  } catch (err) {
    console.error("[Outlook] Callback error:", err);
    res.redirect(`${env.CLIENT_URL}/settings?outlook=error`);
  }
});

router.use(ensureAuth);
// Email integration (connect, scan, backfill, review-queue mutations) is gated
// for the demo user. GET status remains open so the demo UI can render the
// "Not connected" rows.
router.post(/.*/, blockDemoUser);

/* ------------------ Combined status + scan ------------------ */

router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id).select(
      "gmailConnected gmailEmail gmailLastSyncAt outlookConnected outlookEmail outlookLastSyncAt gmailFirstScanCompleted gmailFirstScanDays gmailScanConsent"
    );
    res.json({
      gmail: {
        connected: dbUser?.gmailConnected || false,
        email: dbUser?.gmailEmail || null,
        lastSyncAt: dbUser?.gmailLastSyncAt || null,
        firstScanCompleted: dbUser?.gmailFirstScanCompleted || false,
        firstScanDays: dbUser?.gmailFirstScanDays ?? null,
        hasConsent: !!dbUser?.gmailScanConsent,
      },
      outlook: {
        connected: dbUser?.outlookConnected || false,
        email: dbUser?.outlookEmail || null,
        lastSyncAt: dbUser?.outlookLastSyncAt || null,
        configured: outlook.isOutlookConfigured(),
      },
    });
  } catch (err) { next(err); }
});

router.post("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    let totalApplied = 0;
    let totalScanned = 0;
    const errors: string[] = [];

    if (dbUser.gmailConnected) {
      try {
        const r = await gmail.scanUserInbox(dbUser, { windowDays: 7 });
        totalApplied += r.applied;
        totalScanned += r.scanned;
      } catch (err) {
        const e = err as { message?: string };
        errors.push(`Gmail: ${e.message || "failed"}`);
      }
    }

    if (dbUser.outlookConnected) {
      try {
        const r = await outlook.scanUserInbox(dbUser, { windowDays: 7 });
        totalApplied += r.applied;
        totalScanned += r.scanned;
      } catch (err) {
        const e = err as { message?: string };
        errors.push(`Outlook: ${e.message || "failed"}`);
      }
    }

    if (!dbUser.gmailConnected && !dbUser.outlookConnected) {
      return res.status(400).json({ error: "No mailbox connected" });
    }

    const summary = totalApplied > 0
      ? `Scan complete. ${totalApplied} application${totalApplied === 1 ? "" : "s"} updated.`
      : `Scan complete. No new signals in ${totalScanned} emails.`;

    res.json({ message: summary, applied: totalApplied, scanned: totalScanned, errors });
  } catch (err) { next(err); }
});

/* ------------------ Gmail-specific ------------------ */

router.post("/gmail/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ url: gmail.getAuthUrl(user._id.toString()) });
  } catch (err) { next(err); }
});

// Legacy alias for the existing frontend client.
router.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ url: gmail.getAuthUrl(user._id.toString()) });
  } catch (err) { next(err); }
});

router.post("/gmail/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await gmail.disconnectGmail(user._id.toString());
    res.json({ message: "Gmail disconnected" });
  } catch (err) { next(err); }
});

router.post("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await gmail.disconnectGmail(user._id.toString());
    res.json({ message: "Gmail disconnected" });
  } catch (err) { next(err); }
});

/* ------------------ Outlook-specific ------------------ */

router.post("/outlook/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!outlook.isOutlookConfigured()) {
      return res.status(503).json({ error: "Outlook integration not configured on this server." });
    }
    const user = getUser(req);
    const url = await outlook.getAuthUrl(user._id.toString());
    res.json({ url });
  } catch (err) { next(err); }
});

router.post("/outlook/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await outlook.disconnectOutlook(user._id.toString());
    res.json({ message: "Outlook disconnected" });
  } catch (err) { next(err); }
});

/* ====================================================================== */
/*  First-scan backfill                                                   */
/* ====================================================================== */

function isValidWindow(n: unknown): n is ScanWindowDays {
  return typeof n === "number" && (SCAN_WINDOW_DAYS as readonly number[]).includes(n);
}

/** Kick off the one-time backfill scan. Records consent + window choice,
 *  flags first-scan as completed (so the picker never shows again), and
 *  fires the async worker. Returns the scanJobId immediately. */
router.post("/first-scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const { windowDays, consent } = (req.body ?? {}) as {
      windowDays?: number;
      consent?: boolean;
    };
    if (!consent) throw new AppError("Consent is required to scan your inbox.", 400);
    if (!isValidWindow(windowDays)) {
      throw new AppError("windowDays must be one of 5, 10, or 15.", 400);
    }

    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new AppError("User not found.", 404);
    if (!dbUser.gmailConnected || !dbUser.gmailRefreshToken) {
      throw new AppError("Connect Gmail before starting the inbox backfill.", 400);
    }
    if (dbUser.gmailFirstScanCompleted) {
      throw new AppError("First-time inbox scan has already been performed.", 409);
    }

    // Reject if a non-terminal job is already pending. Avoids accidental dup runs.
    const existing = await EmailScanJob.findOne({
      userId: dbUser._id,
      status: { $in: ["pending", "scanning", "filtering", "classifying"] },
    });
    if (existing) {
      return res.status(202).json({ scanJobId: existing._id.toString(), status: existing.status });
    }

    const acceptedAt = new Date();
    const consentRecord = { acceptedAt, scopeAcknowledged: SCAN_CONSENT_SCOPE_V1 };

    // Record consent + chosen window, but DO NOT mark firstScanCompleted yet —
    // that flag should only flip after the worker actually finishes (or reaches
    // ready_for_review). Otherwise a failed scan permanently hides the picker
    // and the user has no way back. The worker sets it in finalizeJob().
    dbUser.gmailScanConsent = consentRecord;
    dbUser.gmailFirstScanDays = windowDays;
    await dbUser.save();

    const job = await EmailScanJob.create({
      userId: dbUser._id,
      status: "pending",
      windowDays,
      consentSnapshot: { ...consentRecord, windowDays },
    });

    kickoffFirstScan(job._id.toString());
    res.status(202).json({ scanJobId: job._id.toString(), status: "pending" });
  } catch (err) {
    next(err);
  }
});

/** Latest non-completed scan job for this user — used by the frontend poller. */
router.get("/scan-jobs/latest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const job = await EmailScanJob.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
    if (!job) return res.json({ job: null });
    res.json({
      job: {
        _id: job._id.toString(),
        status: job.status,
        windowDays: job.windowDays,
        progress: job.progress,
        counts: job.counts,
        error: job.error,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
    });
  } catch (err) { next(err); }
});

/** List of pending + already-decided candidates for a given scan job. */
router.get("/scan-jobs/:id/candidates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid scan job id.", 400);

    const job = await EmailScanJob.findOne({ _id: id, userId: user._id }).lean();
    if (!job) throw new AppError("Scan job not found.", 404);

    const candidates = await EmailScanCandidate.find({ scanJobId: id })
      .sort({ latestEmailDate: -1 })
      .lean();

    res.json({
      job: {
        _id: job._id.toString(),
        status: job.status,
        windowDays: job.windowDays,
        counts: job.counts,
        error: job.error,
      },
      candidates: candidates.map((c) => ({
        _id: c._id.toString(),
        status: c.status,
        threadId: c.threadId,
        company: c.company,
        role: c.role,
        inferredStage: c.inferredStage,
        confidence: c.confidence,
        earliestEmailDate: c.earliestEmailDate,
        latestEmailDate: c.latestEmailDate,
        evidence: c.evidence,
        matchedApplicationId: c.matchedApplicationId?.toString() ?? null,
        importedApplicationId: c.importedApplicationId?.toString() ?? null,
        importError: c.importError,
      })),
    });
  } catch (err) { next(err); }
});

/** Per-candidate action: import / skip / merge / edit-and-import.
 *  Body:
 *    { action: "import", company?, role?, stage?, applicationDate? }
 *    { action: "skip" }
 *    { action: "merge", targetApplicationId, updateStage?: boolean }
 */
router.post("/scan-candidates/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid candidate id.", 400);

    const candidate = await EmailScanCandidate.findOne({ _id: id, userId: user._id });
    if (!candidate) throw new AppError("Candidate not found.", 404);
    if (candidate.status !== "pending" && candidate.status !== "failed") {
      throw new AppError(`Candidate already ${candidate.status}.`, 409);
    }

    const body = (req.body ?? {}) as {
      action?: string;
      company?: string;
      role?: string;
      stage?: Stage;
      applicationDate?: string;
      targetApplicationId?: string;
      updateStage?: boolean;
    };

    if (body.action === "skip") {
      candidate.status = "skipped";
      candidate.importError = null;
      await candidate.save();
      await bumpCount(candidate.scanJobId.toString(), "skipped", 1);
      return res.json({ ok: true });
    }

    if (body.action === "merge") {
      if (!body.targetApplicationId || !mongoose.Types.ObjectId.isValid(body.targetApplicationId)) {
        throw new AppError("targetApplicationId is required for merge.", 400);
      }
      const target = await Application.findOne({
        _id: body.targetApplicationId,
        userId: user._id,
      });
      if (!target) throw new AppError("Target application not found.", 404);

      // Optionally adopt the inferred stage if it's later in the pipeline.
      if (body.updateStage !== false) {
        const order: Stage[] = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"];
        const inferredIdx = order.indexOf(candidate.inferredStage);
        const currentIdx = order.indexOf(target.stage);
        // Move forward in the pipeline; terminal Rejected/Offer always wins.
        const terminal = candidate.inferredStage === "Rejected" || candidate.inferredStage === "Offer";
        if (terminal || (inferredIdx > -1 && currentIdx > -1 && inferredIdx > currentIdx)) {
          if (target.stage !== candidate.inferredStage) {
            target.stage = candidate.inferredStage;
            target.stageHistory.push({ stage: candidate.inferredStage, date: new Date() });
          }
          if (terminal && candidate.inferredStage === "Rejected") {
            target.archived = true;
            target.archivedAt = new Date();
            target.archivedReason = "rejected";
          }
          await target.save();
        }
      }

      candidate.status = "merged";
      candidate.importedApplicationId = target._id;
      candidate.importError = null;
      await candidate.save();
      await bumpCount(candidate.scanJobId.toString(), "merged", 1);
      return res.json({ ok: true, applicationId: target._id.toString() });
    }

    if (body.action === "import") {
      const company = (body.company ?? candidate.company).trim();
      const role = (body.role ?? candidate.role).trim();
      const stage: Stage = STAGES.includes(body.stage as Stage)
        ? (body.stage as Stage)
        : candidate.inferredStage;
      if (!company) throw new AppError("Company is required.", 400);
      if (!role) throw new AppError("Role is required.", 400);

      const applicationDate = body.applicationDate
        ? new Date(body.applicationDate)
        : candidate.earliestEmailDate;

      try {
        const app = await Application.create({
          userId: user._id,
          company,
          role,
          stage,
          applicationDate,
          source: "email",
          emailImport: {
            scanJobId: candidate.scanJobId,
            candidateId: candidate._id,
            threadId: candidate.threadId,
            importedAt: new Date(),
          },
          // archive rejected imports so they stay out of the active board
          ...(stage === "Rejected"
            ? { archived: true, archivedAt: new Date(), archivedReason: "rejected" as const }
            : {}),
        });
        candidate.status = "imported";
        candidate.importedApplicationId = app._id;
        candidate.importError = null;
        await candidate.save();
        await bumpCount(candidate.scanJobId.toString(), "imported", 1);
        // Roll back a prior failed-counter if we're retrying after a failure.
        if (req.body?._wasFailed) {
          await bumpCount(candidate.scanJobId.toString(), "failed", -1);
        }
        return res.json({ ok: true, applicationId: app._id.toString() });
      } catch (err) {
        const msg = (err as Error)?.message?.slice(0, 300) ?? "Import failed.";
        candidate.status = "failed";
        candidate.importError = msg;
        await candidate.save();
        await bumpCount(candidate.scanJobId.toString(), "failed", 1);
        throw new AppError(`Import failed: ${msg}`, 500);
      }
    }

    throw new AppError("Unknown action.", 400);
  } catch (err) { next(err); }
});

/** Import every pending candidate in one go. Per-candidate failures are
 *  recorded on the candidate doc; the request still returns 200 with a
 *  summary so the user can retry the broken ones from the review UI. */
router.post("/scan-jobs/:id/bulk-import", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid scan job id.", 400);

    const job = await EmailScanJob.findOne({ _id: id, userId: user._id });
    if (!job) throw new AppError("Scan job not found.", 404);

    const pending = await EmailScanCandidate.find({
      scanJobId: id,
      userId: user._id,
      status: { $in: ["pending", "failed"] },
    });

    const summary = { imported: 0, failed: 0, skipped: 0 };
    for (const c of pending) {
      if (!c.company.trim()) {
        // Untrustworthy candidates are silently skipped — surface to the user
        // as "skipped" in the counts.
        c.status = "skipped";
        await c.save();
        summary.skipped++;
        continue;
      }
      const wasFailed = c.status === "failed";
      try {
        const app = await Application.create({
          userId: user._id,
          company: c.company,
          role: c.role || "Role",
          stage: c.inferredStage,
          applicationDate: c.earliestEmailDate,
          source: "email",
          emailImport: {
            scanJobId: c.scanJobId,
            candidateId: c._id,
            threadId: c.threadId,
            importedAt: new Date(),
          },
          ...(c.inferredStage === "Rejected"
            ? { archived: true, archivedAt: new Date(), archivedReason: "rejected" as const }
            : {}),
        });
        c.status = "imported";
        c.importedApplicationId = app._id;
        c.importError = null;
        await c.save();
        summary.imported++;
        if (wasFailed) job.counts.failed = Math.max(0, job.counts.failed - 1);
      } catch (err) {
        const msg = (err as Error)?.message?.slice(0, 300) ?? "Import failed.";
        c.status = "failed";
        c.importError = msg;
        await c.save();
        summary.failed++;
        if (!wasFailed) job.counts.failed += 1;
      }
    }

    job.counts.imported += summary.imported;
    job.counts.skipped += summary.skipped;
    await job.save();
    res.json({ ok: true, ...summary });
  } catch (err) { next(err); }
});

/** Mark every pending candidate as skipped — the "Dismiss all" affordance. */
router.post("/scan-jobs/:id/skip-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid scan job id.", 400);

    const result = await EmailScanCandidate.updateMany(
      { scanJobId: id, userId: user._id, status: { $in: ["pending", "failed"] } },
      { $set: { status: "skipped" } },
    );
    await EmailScanJob.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $inc: { "counts.skipped": result.modifiedCount } },
    );
    res.json({ ok: true, skipped: result.modifiedCount });
  } catch (err) { next(err); }
});

/** Mark the review as complete and stop showing the banner. */
router.post("/scan-jobs/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid scan job id.", 400);

    await EmailScanJob.findOneAndUpdate(
      { _id: id, userId: user._id, status: { $in: ["ready_for_review", "failed"] } },
      { $set: { status: "completed", finishedAt: new Date() } },
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

async function bumpCount(
  jobId: string,
  field: "imported" | "skipped" | "merged" | "failed",
  delta: number,
): Promise<void> {
  await EmailScanJob.updateOne({ _id: jobId }, { $inc: { [`counts.${field}`]: delta } });
}

export default router;
