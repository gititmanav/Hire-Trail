/**
 * The AI ledger — one row per gateway attempt, refusals included.
 *
 * Written by services/ai/gateway.ts and nothing else. A call that may spend
 * Included money first writes a `reserved` row carrying its worst-case cost
 * (`reservedUsd`), which counts toward the caps immediately, so parallel calls
 * can't overshoot; the same row is then `settled` with the real tokens and
 * cost. A row the gateway never got to settle (the function was killed) keeps
 * counting at its reserved worst case — overcounting is the safe direction.
 *
 * `estCostUsd` is stamped at write time from services/ai/pricing.ts, so later
 * price changes never rewrite history. `period` is the UTC month "YYYY-MM",
 * the natural key for monthly caps and allowances.
 *
 * Rows that predate the 2026-10 rebuild carry `opType` and `byok` instead of
 * `feature` and `lane`; the usage lens maps them (services/ai/ledger.ts).
 */
import mongoose, { Schema } from "mongoose";

import { AI_LANES, type AiLane } from "../services/ai/providerIds.js";

export const AI_USAGE_STATUSES = ["reserved", "settled", "refused"] as const;
export type AiUsageStatus = (typeof AI_USAGE_STATUSES)[number];

// NB: not `extends Document` — a data field named `model` would clash with the
// Mongoose Document.model() method. Mongoose hydrates this into a full document.
export interface IAiUsage {
  userId: mongoose.Types.ObjectId;
  /** Billing month "YYYY-MM" (UTC). */
  period: string;
  /** Registry feature id. Missing on legacy rows (see opType). */
  feature?: string;
  lane?: AiLane;
  status?: AiUsageStatus;
  provider: string;
  model: string;
  keyId?: mongoose.Types.ObjectId | null;
  tokensIn: number;
  tokensOut: number;
  estCostUsd: number;
  /** Worst-case cost held while the call runs (Included lane only). */
  reservedUsd?: number;
  ok?: boolean;
  /** Normalized gateway error code when ok is false (services/ai/errors.ts). */
  errorCode?: string | null;
  latencyMs?: number;
  cached?: boolean;
  /** True on the one call per user-visible use (a tailor, an import) — what
   *  per-feature Included limits count. Chunked work marks only its first call. */
  countsAsUse?: boolean;
  promptVersion?: string;
  jobId?: mongoose.Types.ObjectId | null;
  /** Legacy (pre-2026-10) operation name. */
  opType?: string;
  /** Legacy: true when billed to the user's own key. */
  byok?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

const aiUsageSchema = new Schema<IAiUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: String, required: true },
    feature: { type: String },
    lane: { type: String, enum: AI_LANES },
    status: { type: String, enum: AI_USAGE_STATUSES },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    keyId: { type: Schema.Types.ObjectId, ref: "AiKey", default: null },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    estCostUsd: { type: Number, default: 0 },
    reservedUsd: { type: Number, default: 0 },
    ok: { type: Boolean },
    errorCode: { type: String, default: null },
    latencyMs: { type: Number, default: 0 },
    cached: { type: Boolean, default: false },
    countsAsUse: { type: Boolean, default: false },
    promptVersion: { type: String },
    jobId: { type: Schema.Types.ObjectId, ref: "AiJob", default: null },
    opType: { type: String },
    byok: { type: Boolean },
  },
  { timestamps: true },
);

// This user, this month — allowance and the user's usage page.
aiUsageSchema.index({ userId: 1, period: 1 });
// Platform-wide month — the cap, and the admin usage lens by provider / feature.
aiUsageSchema.index({ period: 1, provider: 1 });
aiUsageSchema.index({ period: 1, lane: 1, feature: 1 });

/** Current billing period key in UTC, e.g. "2026-10". */
export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First instant of the NEXT period (when monthly caps reset), UTC. */
export function periodResetsAt(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export const AiUsage = mongoose.model<IAiUsage>("AiUsage", aiUsageSchema);
