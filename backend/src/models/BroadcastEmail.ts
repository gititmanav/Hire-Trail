import mongoose, { Schema, Document, Types } from "mongoose";

export const BROADCAST_STATUSES = ["sending", "completed", "partial", "failed"] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export const BROADCAST_RECIPIENT_TYPES = ["all", "selected"] as const;
export type BroadcastRecipientType = (typeof BROADCAST_RECIPIENT_TYPES)[number];

export interface IBroadcastEmail extends Document {
  _id: Types.ObjectId;
  subject: string;
  bodyHtml: string;
  recipientType: BroadcastRecipientType;
  recipientUserIds: Types.ObjectId[];
  sentByUserId: Types.ObjectId;
  status: BroadcastStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  failedEmails: { email: string; error: string }[];
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const broadcastEmailSchema = new Schema<IBroadcastEmail>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    bodyHtml: { type: String, required: true },
    recipientType: { type: String, enum: BROADCAST_RECIPIENT_TYPES, required: true },
    recipientUserIds: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    sentByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: BROADCAST_STATUSES, default: "sending", index: true },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    failedEmails: [{
      _id: false,
      email: { type: String, required: true },
      error: { type: String, required: true },
    }],
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

broadcastEmailSchema.index({ createdAt: -1 });

export const BroadcastEmail = mongoose.model<IBroadcastEmail>("BroadcastEmail", broadcastEmailSchema);
