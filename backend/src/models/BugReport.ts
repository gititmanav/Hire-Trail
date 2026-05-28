/**
 * BugReport — silently-captured error records surfaced to the admin panel.
 *
 * Captured automatically (no user input) from:
 *   - backend errorHandler middleware on 5xx responses
 *   - async-worker catch blocks (tailor, email scan, etc.)
 *   - frontend axios 5xx responses
 *   - frontend window.onerror + unhandledrejection
 *
 * Dedupe: fingerprint = sha256(errorMessage + first 3 stack frames), 16 chars.
 * Duplicates increment `count` and update `lastSeenAt`/`affectedUserIds`,
 * keeping one row per distinct bug instead of one row per occurrence.
 */
import mongoose, { Schema, Document, Types } from "mongoose";

export const BUG_REPORT_SOURCES = [
  "backend_500",
  "backend_async_worker",
  "frontend_uncaught",
  "frontend_axios_5xx",
  "frontend_unhandled_rejection",
] as const;
export type BugReportSource = (typeof BUG_REPORT_SOURCES)[number];

export const BUG_REPORT_STATUSES = ["new", "triaged", "ignored", "fixed"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export interface IBugReport extends Document {
  _id: Types.ObjectId;
  fingerprint: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  affectedUserIds: Types.ObjectId[];
  source: BugReportSource;
  route: string;
  method: string;
  errorMessage: string;
  errorStack: string;
  userAgent: string;
  /** Sanitized JSON snippet (≤ 2 KB). Never contains password/token/key fields. */
  requestBodyPreview: string;
  status: BugReportStatus;
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

const bugReportSchema = new Schema<IBugReport>(
  {
    fingerprint: { type: String, required: true, index: true },
    count: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    affectedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    source: { type: String, enum: BUG_REPORT_SOURCES, required: true, index: true },
    route: { type: String, default: "" },
    method: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
    errorStack: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    requestBodyPreview: { type: String, default: "" },
    status: { type: String, enum: BUG_REPORT_STATUSES, default: "new", index: true },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true },
);

// Compound: when looking up an existing row to merge into, we only want to
// match *active* (new/triaged) entries. Once an admin marks a row "fixed" or
// "ignored," a recurrence creates a fresh row — which is exactly what you
// want for tracking regressions.
bugReportSchema.index({ fingerprint: 1, status: 1 });
bugReportSchema.index({ status: 1, lastSeenAt: -1 });

export const BugReport = mongoose.model<IBugReport>("BugReport", bugReportSchema);
