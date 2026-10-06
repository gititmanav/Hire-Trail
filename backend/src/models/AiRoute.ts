/**
 * Where an AI feature runs.
 *
 *   scope "platform" — the admin's routing for the Included lane: feature →
 *     platform key + model. The row with feature "default" is the fallback.
 *     Sora's asymmetry applies: the default lends its KEY, but a feature
 *     falling through to it keeps its own curated model for that provider, so
 *     a text-only default model can never silently break another feature.
 *
 *   scope "user" — a user's own choice for one feature: the lane, and for the
 *     My key lane which of their keys and which model.
 *
 * Absence is meaningful: no user row = the feature's default lane; no
 * platform row = fall through to the platform default.
 */
import mongoose, { Schema, Document } from "mongoose";

import { AI_LANES, type AiLane } from "../services/ai/providerIds.js";

export const AI_DEFAULT_ROUTE = "default";

export interface IAiRoute extends Document {
  _id: mongoose.Types.ObjectId;
  scope: "platform" | "user";
  userId: mongoose.Types.ObjectId | null;
  /** Registry feature id, or "default" (platform scope only). */
  feature: string;
  /** User scope only. Platform routes are always the Included lane. */
  lane: AiLane | null;
  keyId: mongoose.Types.ObjectId | null;
  /** Pinned model id; null = the feature's curated default for the key's provider.
   *  (Not `model`: that name is Mongoose's Document.model().) */
  modelId: string | null;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiRouteSchema = new Schema<IAiRoute>(
  {
    scope: { type: String, enum: ["platform", "user"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    feature: { type: String, required: true, maxlength: 60 },
    lane: { type: String, enum: [...AI_LANES, null], default: null },
    keyId: { type: Schema.Types.ObjectId, ref: "AiKey", default: null },
    modelId: { type: String, default: null, maxlength: 160 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

aiRouteSchema.index({ scope: 1, userId: 1, feature: 1 }, { unique: true });
aiRouteSchema.index({ keyId: 1 });

export const AiRoute = mongoose.model<IAiRoute>("AiRoute", aiRouteSchema);
