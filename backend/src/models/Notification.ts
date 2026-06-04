import mongoose, { Schema, Document, Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "rejection_detected",
  "interview_detected",
  "offer_detected",
  "follow_up_detected",
  "info",
  /** First-scan backfill found candidate applications ready for review. */
  "scan_ready",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  applicationId: Types.ObjectId | null;
  /** The scan job a `scan_ready` notification belongs to — lets us resolve it
   *  once the user has worked through that scan's review queue. */
  scanJobId: Types.ObjectId | null;
  /** Source mailbox: gmail | outlook | null (manual/system). */
  source: "gmail" | "outlook" | null;
  /** Provider-side message id used for dedupe across signal types. */
  sourceEmailId: string | null;
  /** The prior stage so the user can revert via "Undo" if the AI got it wrong. */
  previousStage: string | null;
  /** When the user explicitly confirms or reverts a stage suggestion. */
  resolved: boolean;
  resolvedAt: Date | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null },
    scanJobId: { type: Schema.Types.ObjectId, ref: "EmailScanJob", default: null },
    source: { type: String, enum: ["gmail", "outlook", null], default: null },
    sourceEmailId: { type: String, default: null },
    previousStage: { type: String, default: null },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, sourceEmailId: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
