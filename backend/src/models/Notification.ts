import mongoose, { Schema, Document, Types } from "mongoose";

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: "rejection_detected" | "info";
  title: string;
  message: string;
  applicationId: Types.ObjectId | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["rejection_detected", "info"], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
