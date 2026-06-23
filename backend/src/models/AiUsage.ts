/**
 * Per-call AI usage meter.
 *
 * One document is written for every model invocation (see services/ai/run.ts).
 * Aggregated by `GET /api/ai/usage`:
 *   - BYOK users see raw {tokensIn, tokensOut, estCostUsd, period}
 *   - default-key users see {usedPct, used, limit, resetsAt} against their quota
 *
 * `estCostUsd` is computed locally from services/ai/pricing.ts at write time so a
 * later price-table change never rewrites history.
 *
 * `period` is the billing month "YYYY-MM" (UTC). Quotas reset monthly, so this is
 * the natural rollup key and lets us index (userId, period) for cheap sums.
 */
import mongoose, { Schema } from "mongoose";

/** Logical operations that consume AI. Used for per-op breakdowns + analytics. */
export const AI_OP_TYPES = [
  "resume_parse",
  "profile_merge",
  "jd_analysis",
  "field_extract",
  "jd_clean",
  "thread_classify",
  "resume_rewrite",
  "other",
] as const;
export type AiOpType = (typeof AI_OP_TYPES)[number];

// NB: not `extends Document` — a data field named `model` would clash with the
// Mongoose Document.model() method. Mongoose hydrates this into a full document.
export interface IAiUsage {
  userId: mongoose.Types.ObjectId;
  /** Billing month "YYYY-MM" (UTC). */
  period: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  estCostUsd: number;
  opType: AiOpType;
  /** True when billed to the user's own key; false for the admin default key. */
  byok: boolean;
  createdAt: Date;
}

const aiUsageSchema = new Schema<IAiUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: String, required: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    estCostUsd: { type: Number, default: 0 },
    opType: { type: String, enum: AI_OP_TYPES, default: "other" },
    byok: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Primary aggregation: this user, this month, optionally split by byok.
aiUsageSchema.index({ userId: 1, period: 1 });
// Admin-side rollups across all users for a month.
aiUsageSchema.index({ period: 1, provider: 1 });

/** Current billing period key in UTC, e.g. "2026-06". */
export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First instant of the NEXT period (when the monthly quota resets), UTC. */
export function periodResetsAt(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export const AiUsage = mongoose.model<IAiUsage>("AiUsage", aiUsageSchema);
