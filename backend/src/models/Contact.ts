import mongoose, { Schema, Document, Types } from "mongoose";

export const CONNECTION_SOURCES = [
  "Cold email",
  "Referral",
  "Career fair",
  "LinkedIn",
  "Professor intro",
  "Alumni network",
  "Other",
] as const;

export type ConnectionSource = (typeof CONNECTION_SOURCES)[number];

export const CONTACT_OUTREACH_STATUSES = [
  "not_contacted",
  "reached_out",
  "responded",
  "meeting_scheduled",
  "follow_up_needed",
  "gone_cold",
] as const;

export type ContactOutreachStatus = (typeof CONTACT_OUTREACH_STATUSES)[number];

export interface IContact extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  company: string;
  companyId: Types.ObjectId | null;
  role: string;
  linkedinUrl: string;
  connectionSource: string;
  lastContactDate: Date;
  notes: string;
  applicationIds: Types.ObjectId[];
  outreachStatus: ContactOutreachStatus;
  lastOutreachDate: Date | null;
  nextFollowUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: 100,
    },
    company: {
      type: String,
      required: [true, "Company is required"],
      trim: true,
      maxlength: 200,
    },
    role: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    linkedinUrl: {
      type: String,
      default: "",
      trim: true,
    },
    connectionSource: {
      type: String,
      default: "",
      trim: true,
    },
    lastContactDate: {
      type: Date,
      default: Date.now,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    applicationIds: {
      type: [Schema.Types.ObjectId],
      ref: "Application",
      default: [],
    },
    outreachStatus: {
      type: String,
      enum: CONTACT_OUTREACH_STATUSES,
      default: "not_contacted",
    },
    lastOutreachDate: {
      type: Date,
      default: null,
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

contactSchema.index({ userId: 1, company: 1 });

export const Contact = mongoose.model<IContact>("Contact", contactSchema);
