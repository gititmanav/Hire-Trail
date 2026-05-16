/**
 * User-submitted feedback — bugs, suggestions, ideas. Visible to admins.
 *
 * Keep this model intentionally simple: a free-form inbox plus a coarse status
 * lifecycle. Categorize via `type`, prioritize via `severity`, triage via `status`.
 */
import mongoose, { Schema, Document } from "mongoose";

export const FEEDBACK_TYPES = ["bug", "suggestion", "idea", "praise", "other"] as const;
export const FEEDBACK_STATUSES = ["open", "triaged", "in_progress", "resolved", "dismissed"] as const;
export const FEEDBACK_SEVERITIES = ["low", "normal", "high", "critical"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Cached at write so admins see who submitted even if the user is later deleted. */
  userEmail: string;
  userName: string;
  type: FeedbackType;
  /** Severity is editable by admin during triage. */
  severity: FeedbackSeverity;
  /** Short title (≤ 120 chars). */
  title: string;
  /** Full description. */
  message: string;
  /** Where the user was when they opened the feedback widget — e.g. "/profile". */
  pageContext: string;
  /** Browser UA at submission time, useful for bug repro. */
  userAgent: string;
  /** App build / version at submission. */
  appVersion: string;
  status: FeedbackStatus;
  /** Free-form admin notes — internal triage. */
  adminNotes: string;
  /** Admin user who last touched it. */
  resolvedById: mongoose.Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, default: "" },
    userName: { type: String, default: "" },
    type: { type: String, enum: FEEDBACK_TYPES, required: true },
    severity: { type: String, enum: FEEDBACK_SEVERITIES, default: "normal" },
    title: { type: String, required: true, maxlength: 200, trim: true },
    message: { type: String, required: true, maxlength: 8000 },
    pageContext: { type: String, default: "", maxlength: 200 },
    userAgent: { type: String, default: "", maxlength: 500 },
    appVersion: { type: String, default: "", maxlength: 40 },
    status: { type: String, enum: FEEDBACK_STATUSES, default: "open", index: true },
    adminNotes: { type: String, default: "", maxlength: 4000 },
    resolvedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>("Feedback", feedbackSchema);
