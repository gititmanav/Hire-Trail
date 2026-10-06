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

export interface ITailorSectionFlag {
  section: "summary" | "experience" | "projects" | "skills" | "education";
  severity: "good" | "warn" | "gap";
  note: string;
}

export interface ITailorStrength {
  point: string;
  /** Where the profile shows it — quoted or closely paraphrased. */
  evidence: string;
}

export interface ITailorGap {
  point: string;
  severity: "major" | "minor";
}

export interface ITailorChange {
  section: "summary" | "experience" | "projects" | "skills" | "education";
  /** The entry it applies to ("Stripe", "HireTrail"), or "" for the section. */
  target: string;
  change: string;
  why: string;
}

/** "waiting_assistant": the fit check runs in the user's assistant (MCP) and
 *  hasn't been picked up yet. */
export type TailorStatus = "processing" | "succeeded" | "failed" | "deferred" | "waiting_assistant";

export interface ITailorSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Optional — when the JD was tracked as an application, link them. */
  applicationId: mongoose.Types.ObjectId | null;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription: string;
  /** Lifecycle: created in `processing`, flipped to `succeeded`/`failed` by the analyze worker.
   *  Pre-existing docs default to `succeeded` for back-compat with completed history. */
  status: TailorStatus;
  /** Populated when status === "failed". */
  errorMessage: string;
  /** The AI error code behind a failure ("ai_needs_key", …) and the lane it
   *  ran in — the client decides what to offer from these, never the text. */
  errorCode: string;
  errorLane: string;
  /** LEGACY (pre-2026-10): the model's own 1–5 score. New sessions leave it 0. */
  fitScore: number;
  /** LEGACY (pre-2026-10): A–F. New sessions leave it "". */
  fitGrade: "A" | "B" | "C" | "D" | "F" | "";
  /** The one match score, 0–10 — deterministic (keyword coverage of the role's
   *  requirements + resume completeness, services/resume/score.ts) against the
   *  master profile at analysis time. Null until computed (legacy docs are
   *  backfilled by the `tailor-match-score` migration). */
  matchScore: number | null;
  /** The AI's read in words (2–3 sentences). */
  summary: string;
  strengths: ITailorStrength[];
  gaps: ITailorGap[];
  /** What to change, in words. Concrete rewrites are Studio proposals. */
  changes: ITailorChange[];
  /** Cleaned, candidate-independent JD requirement keywords (noise-stripped).
   *  The deterministic coverage/score is computed against this set. Empty on
   *  pre-existing sessions (back-compat) → callers fall back to extractJdKeywords. */
  jdKeywords: string[];
  matchedSkills: string[];
  missingSkills: string[];
  /** Per-section qualitative read for the "See the gap" step. */
  sectionFlags: ITailorSectionFlag[];
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
    status: { type: String, enum: ["processing", "succeeded", "failed", "deferred", "waiting_assistant"], default: "succeeded", index: true },
    errorMessage: { type: String, default: "" },
    errorCode: { type: String, default: "" },
    errorLane: { type: String, default: "" },
    // Min constraint dropped on fitScore because the session is created before analysis runs;
    // the route handler enforces 1..5 after the worker fills it in.
    fitScore: { type: Number, default: 0 },
    fitGrade: { type: String, enum: ["A", "B", "C", "D", "F", ""], default: "" },
    matchScore: { type: Number, default: null, min: 0, max: 10 },
    summary: { type: String, default: "" },
    strengths: {
      type: [new Schema<ITailorStrength>({ point: { type: String, required: true }, evidence: { type: String, default: "" } }, { _id: false })],
      default: [],
    },
    gaps: {
      type: [new Schema<ITailorGap>({ point: { type: String, required: true }, severity: { type: String, enum: ["major", "minor"], default: "minor" } }, { _id: false })],
      default: [],
    },
    changes: {
      type: [new Schema<ITailorChange>({
        section: { type: String, enum: ["summary", "experience", "projects", "skills", "education"], required: true },
        target: { type: String, default: "" },
        change: { type: String, required: true },
        why: { type: String, default: "" },
      }, { _id: false })],
      default: [],
    },
    jdKeywords: { type: [String], default: [] },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    sectionFlags: {
      type: [new Schema<ITailorSectionFlag>({
        section: { type: String, enum: ["summary", "experience", "projects", "skills", "education"], required: true },
        severity: { type: String, enum: ["good", "warn", "gap"], required: true },
        note: { type: String, default: "" },
      }, { _id: false })],
      default: [],
    },
    suggestions: { type: [suggestionSchema], default: [] },
    provider: { type: String, default: "" },
    modelId: { type: String, default: "" },
  },
  { timestamps: true }
);

tailorSessionSchema.index({ userId: 1, createdAt: -1 });

export const TailorSession = mongoose.model<ITailorSession>("TailorSession", tailorSessionSchema);
