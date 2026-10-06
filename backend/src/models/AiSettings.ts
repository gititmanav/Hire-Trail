/**
 * The platform's AI policy — one document (`_id: "global"`), edited only in
 * Admin → AI. Everything the gateway decides before it calls a model reads
 * from here: the master switch, which lanes exist, the Included budget, the
 * per-feature rules (kill switch, allowed lanes, a forced lane, Included
 * limits), and the MCP limits.
 *
 * Feature rules are an ARRAY of entries keyed by `feature` — not a map:
 * registry ids contain dots ("resume.tailor"), which Mongo would read as a
 * nested path. A feature with no entry — or a field missing from an entry,
 * on documents that predate it — reads as the registry default
 * (services/ai/settings.ts normalizes), so a new feature works the day it
 * ships without a migration.
 */
import mongoose, { Schema } from "mongoose";

import { AI_LANES, type AiLane } from "../services/ai/providerIds.js";

export interface AiFeaturePolicyDoc {
  feature: string;
  enabled?: boolean;
  allowedLanes?: AiLane[];
  forcedLane?: AiLane | null;
  defaultLane?: AiLane;
  /** Included uses per user per month; 0 = no count limit (the allowance still applies). */
  includedMonthlyLimit?: number;
}

export interface IAiSettings {
  _id: string;
  aiEnabled: boolean;
  /** Shown to users while AI is paused. Empty = the standard sentence. */
  pauseMessage: string;
  /** When false, users see their AI map read-only; features follow admin defaults. */
  userMapEnabled: boolean;
  lanes: { included: boolean; byok: boolean; assistant: boolean };
  budget: {
    /** Hard cap on Included spend across all users per calendar month (UTC), USD. 0 = Included off. */
    monthlyCapUsd: number;
    /** What one user may spend on Included per month, USD. 0 = no per-user limit. */
    perUserAllowanceUsd: number;
    /** Admins get a notification as spend crosses each of these percentages of the cap. */
    alertAtPct: number[];
  };
  /** Free-tier keys (Google AI Studio) may receive email content. Off by default. */
  freeTierKeysForEmail: boolean;
  mcp: {
    enabled: boolean;
    callsPerHour: number;
    writesPerHour: number;
    writeToolsEnabled: boolean;
  };
  features: AiFeaturePolicyDoc[];
  /** Spend alerts already sent this period ("2026-10:80"), so each fires once. */
  alertsSent: string[];
  updatedBy: mongoose.Types.ObjectId | null;
  updatedAt: Date;
}

const aiSettingsSchema = new Schema<IAiSettings>(
  {
    _id: { type: String, default: "global" },
    aiEnabled: { type: Boolean, default: true },
    pauseMessage: { type: String, default: "", maxlength: 280 },
    userMapEnabled: { type: Boolean, default: true },
    lanes: {
      included: { type: Boolean, default: true },
      byok: { type: Boolean, default: true },
      assistant: { type: Boolean, default: true },
    },
    budget: {
      monthlyCapUsd: { type: Number, default: 25, min: 0 },
      perUserAllowanceUsd: { type: Number, default: 0.5, min: 0 },
      alertAtPct: { type: [Number], default: [50, 80, 100] },
    },
    freeTierKeysForEmail: { type: Boolean, default: false },
    mcp: {
      enabled: { type: Boolean, default: true },
      callsPerHour: { type: Number, default: 600, min: 1 },
      writesPerHour: { type: Number, default: 120, min: 0 },
      writeToolsEnabled: { type: Boolean, default: true },
    },
    features: {
      type: [
        new Schema<AiFeaturePolicyDoc>(
          {
            feature: { type: String, required: true },
            enabled: Boolean,
            allowedLanes: { type: [String], enum: AI_LANES, default: undefined },
            forcedLane: { type: String, enum: [...AI_LANES, null] },
            defaultLane: { type: String, enum: AI_LANES },
            includedMonthlyLimit: { type: Number, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    alertsSent: { type: [String], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true }, minimize: false },
);

export const AiSettings = mongoose.model<IAiSettings>("AiSettings", aiSettingsSchema);
