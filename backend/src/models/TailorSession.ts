/**
 * Tailor session — one per (user, application) attempt.
 *
 * Records the JD analysis output from the LLM plus the user's accept/reject decisions
 * on each suggestion. The accepted set forms the "tailored variant" of the master
 * profile used when rendering the final PDF.
 */
import mongoose, { Schema, Document } from "mongoose";

export interface ITailorSuggestion {
  section: "summary" | "experience" | "project" | "skills";
  kind: "rewrite" | "add" | "reorder" | "emphasize";
  targetCompanyOrName: string;
  targetBullet: string;
  suggested: string;
  rationale: string;
  tags: string[];
  /** User's decision. Null = pending. */
  decision: "accepted" | "rejected" | null;
}

export interface ITailorSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Optional — when the JD was tracked as an application, link them. */
  applicationId: mongoose.Types.ObjectId | null;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription: string;
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: ITailorSuggestion[];
  provider: string;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

const suggestionSchema = new Schema<ITailorSuggestion>({
  section: { type: String, enum: ["summary", "experience", "project", "skills"], required: true },
  kind: { type: String, enum: ["rewrite", "add", "reorder", "emphasize"], required: true },
  targetCompanyOrName: { type: String, default: "" },
  targetBullet: { type: String, default: "" },
  suggested: { type: String, required: true },
  rationale: { type: String, default: "" },
  tags: { type: [String], default: [] },
  decision: { type: String, enum: ["accepted", "rejected", null], default: null },
}, { _id: true });

const tailorSessionSchema = new Schema<ITailorSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", default: null, index: true },
    jobTitle: { type: String, default: "" },
    company: { type: String, default: "" },
    jobUrl: { type: String, default: "" },
    jobDescription: { type: String, default: "" },
    fitScore: { type: Number, min: 1, max: 5, required: true },
    fitGrade: { type: String, enum: ["A", "B", "C", "D", "F"], required: true },
    summary: { type: String, default: "" },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    suggestions: { type: [suggestionSchema], default: [] },
    provider: { type: String, default: "" },
    modelId: { type: String, default: "" },
  },
  { timestamps: true }
);

tailorSessionSchema.index({ userId: 1, createdAt: -1 });

export const TailorSession = mongoose.model<ITailorSession>("TailorSession", tailorSessionSchema);
