/**
 * Cached brand logo per AI provider for the BYOK picker.
 *
 * Resolved once (Google favicon service → Cloudinary) then reused — same pattern
 * as company logos (services note: logo.clearbit.com is dead since the HubSpot
 * acquisition, so we use Google's reliable favicon CDN as the source). One row
 * per provider id; `fetchedAt` suppresses retries when a source had no logo.
 */
import mongoose, { Schema } from "mongoose";

export interface IAiProviderLogo {
  provider: string;
  /** Cloudinary URL (empty string when resolution failed — retry suppressed). */
  url: string;
  publicId: string;
  fetchedAt: Date;
}

const schema = new Schema<IAiProviderLogo>(
  {
    provider: { type: String, required: true, unique: true },
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const AiProviderLogo = mongoose.model<IAiProviderLogo>("AiProviderLogo", schema);
