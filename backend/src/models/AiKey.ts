/**
 * The AI key vault — every provider key HireTrail holds, platform-owned (the
 * admin's keys that fund the Included lane) and user-owned (My key).
 *
 * The secret is AES-GCM ciphertext (utils/encryption.ts) and never leaves the
 * server; `last4` is the only readable trace. Health lives on the row
 * (`lastCheckedAt` / `lastError`) and is stamped by the gateway after every
 * call and by "Check now", so the maps can paint a failing key red.
 *
 * Replaces AIProviderConfig (the gateway-era table). The one-time migration
 * `ai-keys-from-provider-configs` copies the supported rows across.
 */
import mongoose, { Schema, Document } from "mongoose";

import { AI_PROVIDER_IDS, type AiProviderId } from "../services/ai/providerIds.js";

export type AiKeyOwner = "platform" | "user";

export interface IAiKey extends Document {
  _id: mongoose.Types.ObjectId;
  owner: AiKeyOwner;
  /** Set for user keys; null for platform keys. */
  userId: mongoose.Types.ObjectId | null;
  provider: AiProviderId;
  /** The nickname people see ("Personal Gemini"). */
  name: string;
  encryptedKey: string;
  last4: string;
  /** Google AI Studio keys: true when the key is on Google's free tier, where
   *  Google may use what it receives to improve its products. Stated by the
   *  owner at save time (the API can't tell us). Gates email-class features. */
  freeTier: boolean;
  lastCheckedAt: Date | null;
  /** Plain-words reason the key last failed (auth/quota), or null when healthy. */
  lastError: string | null;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiKeySchema = new Schema<IAiKey>(
  {
    owner: { type: String, enum: ["platform", "user"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    provider: { type: String, enum: AI_PROVIDER_IDS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    encryptedKey: { type: String, required: true },
    last4: { type: String, default: "" },
    freeTier: { type: Boolean, default: false },
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const out = ret as Record<string, unknown>;
        delete out.encryptedKey;
        delete out.__v;
        return out;
      },
    },
  },
);

aiKeySchema.index({ owner: 1, userId: 1, createdAt: 1 });

export const AiKey = mongoose.model<IAiKey>("AiKey", aiKeySchema);
