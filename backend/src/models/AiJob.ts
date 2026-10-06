/**
 * A unit of AI work that may outlive the request that started it.
 *
 * Lifecycle (services/ai/jobs.ts):
 *   queued → running (holds a lease, extended by heartbeats) → succeeded | failed
 *   queued → waiting_assistant (the feature runs in the user's assistant over
 *            MCP) → running (claimed by the assistant) → succeeded | failed
 *
 * A job is started with `waitUntil`, so Vercel keeps the function alive until
 * it settles. If the instance dies anyway, the lease runs out and the next
 * status read (or the daily sweep) puts it back in the queue — the UI's
 * progress comes from this row, so a refresh never loses it.
 */
import mongoose, { Schema, Document } from "mongoose";

export const AI_JOB_STATUSES = ["queued", "running", "succeeded", "failed", "waiting_assistant", "cancelled"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export interface IAiJob extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Registry feature id — what the job does, for the ledger, the maps and MCP. */
  feature: string;
  /** Handler name in jobs.ts (one feature may have several handlers). */
  kind: string;
  status: AiJobStatus;
  attempts: number;
  maxAttempts: number;
  leaseUntil: Date | null;
  /** Who holds the lease: "server", or "mcp:<tokenId>" when an assistant claimed it. */
  leaseHolder: string | null;
  /** What the job works on, for lookups ("application", id). */
  refType: string | null;
  refId: mongoose.Types.ObjectId | null;
  input: Record<string, unknown>;
  /** Resumable state for multi-step jobs (cursor, partial results). */
  state: Record<string, unknown>;
  progress: { label: string; done: number; total: number };
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiJobSchema = new Schema<IAiJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    feature: { type: String, required: true },
    kind: { type: String, required: true },
    status: { type: String, enum: AI_JOB_STATUSES, default: "queued" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 2 },
    leaseUntil: { type: Date, default: null },
    leaseHolder: { type: String, default: null },
    refType: { type: String, default: null },
    refId: { type: Schema.Types.ObjectId, default: null },
    input: { type: Schema.Types.Mixed, default: {} },
    state: { type: Schema.Types.Mixed, default: {} },
    progress: {
      label: { type: String, default: "" },
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    result: { type: Schema.Types.Mixed, default: null },
    error: {
      type: new Schema({ code: String, message: String }, { _id: false }),
      default: null,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

aiJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
aiJobSchema.index({ refType: 1, refId: 1, kind: 1, createdAt: -1 });
aiJobSchema.index({ status: 1, leaseUntil: 1 });
// Settled jobs are history, not records: they expire 30 days after finishing.
// (A live job has no finishedAt, so the TTL never touches it.)
aiJobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AiJob = mongoose.model<IAiJob>("AiJob", aiJobSchema);
