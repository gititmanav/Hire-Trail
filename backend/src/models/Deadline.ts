import mongoose, { Schema, Document, Types } from "mongoose";

export const DEADLINE_TYPES = [
  "OA due date",
  "Follow-up reminder",
  "Interview prep",
  "Offer decision",
  "Thank you note",
  "Other",
] as const;

export type DeadlineType = (typeof DEADLINE_TYPES)[number];

export interface IDeadline extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  applicationId: Types.ObjectId | null;
  type: string;
  dueDate: Date;
  completed: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const deadlineSchema = new Schema<IDeadline>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },
    type: {
      type: String,
      required: [true, "Deadline type is required"],
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

deadlineSchema.index({ userId: 1, dueDate: 1 });
deadlineSchema.index({ userId: 1, completed: 1 });

export const Deadline = mongoose.model<IDeadline>("Deadline", deadlineSchema);
