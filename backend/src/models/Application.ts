import mongoose, { Schema, Document, Types } from "mongoose";

export const STAGES = [
  "Applied",
  "OA",
  "Interview",
  "Offer",
  "Rejected",
] as const;

export const OUTREACH_STATUSES = [
  "none",
  "reached_out",
  "referred",
  "response_received",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const ARCHIVE_REASONS = [
  "auto_stale",
  "rejected",
  "manual",
] as const;

export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export type Stage = (typeof STAGES)[number];

interface StageEntry {
  stage: Stage;
  date: Date;
}

export interface IApplication extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  company: string;
  companyId: Types.ObjectId | null;
  role: string;
  jobUrl: string;
  applicationDate: Date;
  stage: Stage;
  stageHistory: StageEntry[];
  notes: string;
  resumeId: Types.ObjectId | null;
  contactId: Types.ObjectId | null;
  outreachStatus: OutreachStatus;
  archived: boolean;
  archivedAt: Date | null;
  archivedReason: ArchiveReason | null;
  createdAt: Date;
  updatedAt: Date;
}

const stageEntrySchema = new Schema<StageEntry>(
  {
    stage: { type: String, enum: STAGES, required: true },
    date: { type: Date, required: true },
  },
  { _id: false }
);

const applicationSchema = new Schema<IApplication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: [true, "Company is required"],
      trim: true,
      maxlength: 200,
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
      maxlength: 200,
    },
    jobUrl: {
      type: String,
      default: "",
      trim: true,
    },
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    stage: {
      type: String,
      enum: STAGES,
      default: "Applied",
      index: true,
    },
    stageHistory: {
      type: [stageEntrySchema],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    outreachStatus: {
      type: String,
      enum: OUTREACH_STATUSES,
      default: "none",
    },
    archived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedReason: {
      type: String,
      enum: [...ARCHIVE_REASONS, null],
      default: null,
    },
  },
  { timestamps: true }
);

// Compound indexes for common queries
applicationSchema.index({ userId: 1, stage: 1 });
applicationSchema.index({ userId: 1, applicationDate: -1 });
applicationSchema.index({ userId: 1, resumeId: 1 });
applicationSchema.index({ userId: 1, archived: 1 });
applicationSchema.index({ userId: 1, companyId: 1 });

// Auto-add initial stage to history on create
applicationSchema.pre("save", function (next) {
  if (this.isNew && this.stageHistory.length === 0) {
    this.stageHistory.push({ stage: this.stage, date: new Date() });
  }
  next();
});

export const Application = mongoose.model<IApplication>(
  "Application",
  applicationSchema
);
