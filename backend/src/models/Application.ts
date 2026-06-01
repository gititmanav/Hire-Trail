import mongoose, { Schema, Document, Types } from "mongoose";

export const STAGES = [
  "Drafting",
  "Applied",
  "OA",
  "Interview",
  "Offer",
  "Rejected",
] as const;

/** Stages that count toward the conversion funnel. "Drafting" is excluded — it's a
 *  pre-submission state (user is tailoring a resume but hasn't applied yet). */
export const FUNNEL_STAGES = [
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

export const APPLICATION_SOURCES = ["manual", "extension", "email"] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

/** Status of the on-create AI pass that extracts structured fields and cleans
 *  the (often page-dump) job description. "idle" = never ran / not applicable. */
export const AI_EXTRACTION_STATUSES = ["idle", "processing", "done", "failed"] as const;
export type AiExtractionStatus = (typeof AI_EXTRACTION_STATUSES)[number];

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
  jobDescription: string;
  location: string;
  salary: string;
  jobType: string;
  notes: string;
  resumeId: Types.ObjectId | null;
  /** Optional pointer to the tailor session that produced this application.
   *  Drafting-stage applications always have this set; other stages may inherit
   *  it after a Drafting → Applied transition. */
  tailorSessionId: Types.ObjectId | null;
  contactId: Types.ObjectId | null;
  outreachStatus: OutreachStatus;
  archived: boolean;
  archivedAt: Date | null;
  archivedReason: ArchiveReason | null;
  source: ApplicationSource;
  /** Lifecycle of the on-create AI field-extraction + JD-cleaning pass. Drives
   *  the "AI is reading this posting…" indicator on the application row. */
  aiExtractionStatus: AiExtractionStatus;
  /** Set when this application was created via Gmail inbox backfill.
   *  Drives the "From email" chip in the UI and lets us trace back to the
   *  scan job + candidate that produced it. */
  emailImport: {
    scanJobId: Types.ObjectId;
    candidateId: Types.ObjectId;
    threadId: string;
    importedAt: Date;
  } | null;
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
    jobDescription: {
      type: String,
      default: "",
      maxlength: 50000,
    },
    location: {
      type: String,
      default: "",
      maxlength: 200,
    },
    salary: {
      type: String,
      default: "",
      maxlength: 200,
    },
    jobType: {
      type: String,
      default: "",
      maxlength: 200,
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
    tailorSessionId: {
      type: Schema.Types.ObjectId,
      ref: "TailorSession",
      default: null,
      index: true,
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
    source: {
      type: String,
      enum: APPLICATION_SOURCES,
      default: "manual",
      index: true,
    },
    aiExtractionStatus: {
      type: String,
      enum: AI_EXTRACTION_STATUSES,
      default: "idle",
    },
    emailImport: {
      type: new Schema(
        {
          scanJobId: { type: Schema.Types.ObjectId, ref: "EmailScanJob", required: true },
          candidateId: { type: Schema.Types.ObjectId, ref: "EmailScanCandidate", required: true },
          threadId: { type: String, required: true },
          importedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
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
applicationSchema.index({ userId: 1, jobUrl: 1 });

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
