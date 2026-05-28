/**
 * EmailScanCandidate — one inferred application from a backfill scan.
 *
 * The async scan worker writes one of these per Gmail thread that the
 * LLM identified as job-related. The review queue UI reads them, and the
 * import endpoint promotes each into a real Application document.
 *
 * Each candidate is independent — if importing one throws, the rest are
 * unaffected, and a retry-failed endpoint can reprocess just the broken
 * ones. That's the partial-failure resilience.
 */
import mongoose, { Schema, Document, Types } from "mongoose";
import { STAGES, type Stage } from "./Application.js";

export const CANDIDATE_STATUSES = [
  "pending",  // emitted by classifier, awaiting user decision
  "imported", // user clicked Import — Application created
  "skipped",  // user clicked Skip — no Application created
  "merged",   // user merged into an existing Application (stage may have been updated)
  "failed",   // import attempt threw — retryable
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_CONFIDENCES = ["high", "medium", "low"] as const;
export type CandidateConfidence = (typeof CANDIDATE_CONFIDENCES)[number];

interface CandidateEvidence {
  /** Latest email's From header (display name + address). */
  from: string;
  /** Latest email's subject. */
  subject: string;
  /** First ~280 chars of the latest email body. */
  snippet: string;
  /** Provider-side message id of the latest email — links back to Gmail. */
  latestMessageId: string;
  /** Count of messages in the thread, for the UI badge. */
  threadSize: number;
}

export interface IEmailScanCandidate extends Document {
  _id: Types.ObjectId;
  scanJobId: Types.ObjectId;
  userId: Types.ObjectId;
  status: CandidateStatus;
  /** Gmail thread id this candidate was grouped from. */
  threadId: string;
  /** Inferred company name (LLM-extracted or domain-derived). */
  company: string;
  /** Inferred role/title — empty string if not detectable. */
  role: string;
  /** Stage the LLM thinks this application is in based on the latest signal. */
  inferredStage: Stage;
  confidence: CandidateConfidence;
  /** Earliest email date in the thread — used as applicationDate when imported. */
  earliestEmailDate: Date;
  /** Latest email date — surfaces in the UI ("last activity"). */
  latestEmailDate: Date;
  evidence: CandidateEvidence;
  /** If a fuzzy match was found against the user's existing apps, points to it.
   *  The review UI uses this to offer "Merge" instead of "Import". */
  matchedApplicationId: Types.ObjectId | null;
  /** Set once the candidate is imported — points to the created Application. */
  importedApplicationId: Types.ObjectId | null;
  /** Most-recent import error message, surfaced in the review UI's "Retry" affordance. */
  importError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const candidateEvidenceSchema = new Schema<CandidateEvidence>(
  {
    from: { type: String, default: "" },
    subject: { type: String, default: "" },
    snippet: { type: String, default: "" },
    latestMessageId: { type: String, default: "" },
    threadSize: { type: Number, default: 1 },
  },
  { _id: false },
);

const emailScanCandidateSchema = new Schema<IEmailScanCandidate>(
  {
    scanJobId: { type: Schema.Types.ObjectId, ref: "EmailScanJob", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: CANDIDATE_STATUSES, default: "pending", index: true },
    threadId: { type: String, required: true },
    company: { type: String, default: "", trim: true, maxlength: 200 },
    role: { type: String, default: "", trim: true, maxlength: 200 },
    inferredStage: { type: String, enum: STAGES, default: "Applied" },
    confidence: { type: String, enum: CANDIDATE_CONFIDENCES, default: "medium" },
    earliestEmailDate: { type: Date, required: true },
    latestEmailDate: { type: Date, required: true },
    evidence: { type: candidateEvidenceSchema, default: () => ({}) },
    matchedApplicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null },
    importedApplicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null },
    importError: { type: String, default: null },
  },
  { timestamps: true },
);

emailScanCandidateSchema.index({ scanJobId: 1, status: 1 });
emailScanCandidateSchema.index({ userId: 1, threadId: 1 });

export const EmailScanCandidate = mongoose.model<IEmailScanCandidate>(
  "EmailScanCandidate",
  emailScanCandidateSchema,
);
