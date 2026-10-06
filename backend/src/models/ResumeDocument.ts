/**
 * Structured, editable resume document — one per tailored resume.
 *
 * Derived from the master profile + ACCEPTED tailor suggestions (keeping ALL
 * unchanged content), then edited by the user and/or the section-scoped AI
 * rewriter. Stored as Mixed because the canonical shape lives in
 * services/resume/types.ts (ResumeDocument) and is validated at the route layer;
 * Mongoose strict-subdocument typing on a deeply nested editor doc buys little.
 *
 * `history` is a bounded snapshot ring (newest last) taken BEFORE each rewrite so
 * the UI can undo any change via POST /api/resumes/:id/revert {toVersion}.
 */
import mongoose, { Schema, Document } from "mongoose";

import type { ResumeDocument as ResumeDocShape } from "../services/resume/types.js";

/** Max retained snapshots — enough for a comfortable undo stack without letting
 *  the doc grow unbounded for users who rewrite many times. Oldest drop first. */
export const MAX_DOC_HISTORY = 20;

export interface IResumeDocVersion {
  version: number;
  document: ResumeDocShape;
  /** Deterministic match score at the time of the snapshot. */
  score: number;
  /** Human-readable label, e.g. "Before AI rewrite (experience)". */
  label: string;
  createdAt: Date;
}

/** A proposed rewrite of one bullet or the summary. Nothing in the document
 *  changes until the person accepts it (services/ai/features/resumeTailor.ts). */
export interface IResumeProposal {
  id: string;
  /** Element id in the document (a bullet id, or the summary entry id). */
  path: string;
  kind: "bullet" | "summary";
  /** The text it was proposed against — accepting is refused if it changed. */
  before: string;
  after: string;
  reason: string;
  /** "ai" = HireTrail ran it; "assistant" = the user's assistant over MCP. */
  source: "ai" | "assistant";
  createdAt: Date;
}

export interface IResumeDocument extends Document {
  resumeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** The live document — { meta, sections, style }. */
  document: ResumeDocShape;
  /** Monotonic version, bumped on every persisted mutation. */
  version: number;
  /** JD keyword set this doc is scored against (from the tailor analysis). */
  jdKeywords: string[];
  /** Tailor session that seeded this document, when applicable. */
  tailorSessionId: mongoose.Types.ObjectId | null;
  history: IResumeDocVersion[];
  proposals: IResumeProposal[];
  createdAt: Date;
  updatedAt: Date;
}

const versionSchema = new Schema<IResumeDocVersion>(
  {
    version: { type: Number, required: true },
    document: { type: Schema.Types.Mixed, required: true },
    score: { type: Number, default: 0 },
    label: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const resumeDocumentSchema = new Schema<IResumeDocument>(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    document: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, default: 1 },
    jdKeywords: { type: [String], default: [] },
    tailorSessionId: { type: Schema.Types.ObjectId, ref: "TailorSession", default: null },
    history: { type: [versionSchema], default: [] },
    proposals: {
      type: [new Schema<IResumeProposal>({
        id: { type: String, required: true },
        path: { type: String, required: true },
        kind: { type: String, enum: ["bullet", "summary"], required: true },
        before: { type: String, default: "" },
        after: { type: String, required: true },
        reason: { type: String, default: "" },
        source: { type: String, enum: ["ai", "assistant"], default: "ai" },
        createdAt: { type: Date, default: Date.now },
      }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true, minimize: false }
);

export const ResumeDocument = mongoose.model<IResumeDocument>("ResumeDocument", resumeDocumentSchema);
