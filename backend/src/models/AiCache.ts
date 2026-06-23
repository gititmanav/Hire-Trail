/**
 * Content-hash cache for deterministic AI outputs.
 *
 * Resume parses and JD analyses are pure functions of (opType, model, input):
 * re-running the same PDF text or the same JD+profile through the same model
 * yields the same structured result. We hash those inputs and memoize the
 * validated output so a retry, a duplicate upload, or two users analyzing the
 * same JD don't pay the model twice.
 *
 * Cache is keyed by hash only (not userId) — the hash already folds in the model
 * id, so a BYOK user and a default-key user who feed identical input share a hit.
 * That's safe: the cached value is derived solely from the input text the caller
 * provided, never from another user's private data. Entries expire via a TTL
 * index so the collection self-prunes.
 */
import mongoose, { Schema } from "mongoose";

import type { AiOpType } from "./AiUsage.js";

// Not `extends Document`: the `model` field would clash with Document.model().
export interface IAiCache {
  /** sha256 of `${opType}:${model}:${input}` — see services/ai/cache.ts. */
  hash: string;
  opType: AiOpType;
  model: string;
  /** The validated structured result (whatever the op returns). */
  result: unknown;
  createdAt: Date;
  /** TTL anchor — Mongo reaps the doc once this passes. */
  expiresAt: Date;
}

const aiCacheSchema = new Schema<IAiCache>(
  {
    hash: { type: String, required: true, unique: true },
    opType: { type: String, required: true },
    model: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    // expireAfterSeconds: 0 → Mongo deletes the doc when `expiresAt` is reached.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: false }
);

export const AiCache = mongoose.model<IAiCache>("AiCache", aiCacheSchema);
