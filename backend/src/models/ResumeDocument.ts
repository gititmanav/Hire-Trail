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
  },
  { timestamps: true, minimize: false }
);

export const ResumeDocument = mongoose.model<IResumeDocument>("ResumeDocument", resumeDocumentSchema);
