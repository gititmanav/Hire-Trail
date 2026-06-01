/**
 * EmailScanJob — one-time backfill scan of a user's Gmail inbox.
 *
 * Lifecycle:
 *   pending → scanning (Gmail fetch) → filtering (domain + regex)
 *   → classifying (batched LLM) → ready_for_review → completed | failed
 *
 * State lives in the DB so an async worker can run after the HTTP response
 * returns, and a periodic reaper can mark abandoned jobs failed after server
 * restarts. Each candidate the scan finds is a separate EmailScanCandidate
 * document — that's what makes partial-failure recovery clean: imported
 * candidates stay imported, the rest can be retried.
 */
import mongoose, { Schema, Document, Types } from "mongoose";

export const SCAN_JOB_STATUSES = [
  "pending",
  "scanning",
  "filtering",
  "classifying",
  "ready_for_review",
  "completed",
  "failed",
] as const;
export type ScanJobStatus = (typeof SCAN_JOB_STATUSES)[number];

export const SCAN_WINDOW_DAYS = [5, 10, 15] as const;
export type ScanWindowDays = (typeof SCAN_WINDOW_DAYS)[number];

/** "backfill" = the one-time first-scan over a 5/10/15-day window.
 *  "manual"  = a returning user's "Scan now", scoped to an absolute time range
 *  (afterEpochSec → now) instead of a day-window. Both run the same worker. */
export const SCAN_JOB_KINDS = ["backfill", "manual"] as const;
export type ScanJobKind = (typeof SCAN_JOB_KINDS)[number];

interface ScanProgress {
  /** Gmail messages returned by the optimized q: search (pre-filter pool). */
  fetched: number;
  /** Messages that survived the domain + regex pre-filter. */
  candidates: number;
  /** Unique Gmail threadIds among the candidates. */
  threadGroups: number;
  /** Threads classified by the LLM so far. */
  classified: number;
}

interface ScanCounts {
  /** Distinct application candidates emitted to the review queue. */
  totalCandidates: number;
  /** Candidates the user has imported into HireTrail. */
  imported: number;
  /** Candidates the user marked Skip. */
  skipped: number;
  /** Candidates merged into an existing application (dedupe). */
  merged: number;
  /** Candidates whose import attempt threw. Retryable. */
  failed: number;
}

interface ConsentSnapshot {
  scopeAcknowledged: string;
  acceptedAt: Date;
  windowDays: number;
}

export interface IEmailScanJob extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: ScanJobStatus;
  kind: ScanJobKind;
  windowDays: number;
  /** Absolute lower bound (Unix seconds) for the Gmail `after:` filter. Set for
   *  manual scans ("since 1 AM today"); null for backfill (uses windowDays). */
  afterEpochSec: number | null;
  progress: ScanProgress;
  counts: ScanCounts;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  /** Frozen at job-creation time so changing the policy later doesn't
   *  retroactively change the consent record we relied on for this scan. */
  consentSnapshot: ConsentSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const scanProgressSchema = new Schema<ScanProgress>(
  {
    fetched: { type: Number, default: 0 },
    candidates: { type: Number, default: 0 },
    threadGroups: { type: Number, default: 0 },
    classified: { type: Number, default: 0 },
  },
  { _id: false },
);

const scanCountsSchema = new Schema<ScanCounts>(
  {
    totalCandidates: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    merged: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false },
);

const consentSnapshotSchema = new Schema<ConsentSnapshot>(
  {
    scopeAcknowledged: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
    windowDays: { type: Number, required: true },
  },
  { _id: false },
);

const emailScanJobSchema = new Schema<IEmailScanJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: SCAN_JOB_STATUSES, default: "pending", index: true },
    kind: { type: String, enum: SCAN_JOB_KINDS, default: "backfill" },
    windowDays: { type: Number, required: true },
    afterEpochSec: { type: Number, default: null },
    progress: { type: scanProgressSchema, default: () => ({}) },
    counts: { type: scanCountsSchema, default: () => ({}) },
    error: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    consentSnapshot: { type: consentSnapshotSchema, required: true },
  },
  { timestamps: true },
);

emailScanJobSchema.index({ userId: 1, createdAt: -1 });
emailScanJobSchema.index({ status: 1, startedAt: 1 }); // reaper sweep

export const EmailScanJob = mongoose.model<IEmailScanJob>("EmailScanJob", emailScanJobSchema);
