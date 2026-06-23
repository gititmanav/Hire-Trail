import mongoose, { Schema, Document } from "mongoose";

/** CURATED providers with rich first-class metadata (labels, models, validation,
 *  credential shape). The gateway can route to MANY more (40+) — those are merged
 *  in dynamically from the live model list (services/ai/gatewayModels.ts), so the
 *  stored `provider` is a free string, not limited to this set. This list only
 *  drives ordering + curated metadata + the env/direct-SDK fallback. */
export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "bedrock",
  "mistral",
  "xai",
  "groq",
  "deepseek",
  "openrouter",
  "perplexity",
  "cohere",
] as const;
/** A curated provider id. Stored configs may use ANY gateway provider string. */
export type AIProvider = (typeof AI_PROVIDERS)[number];

export interface IAIProviderConfig extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Gateway provider id — curated or dynamic (free string, not the closed set). */
  provider: string;
  /** AES-GCM ciphertext via utils/encryption.ts. Never returned to clients. */
  encryptedKey: string;
  /** Last 4 chars of the raw key, kept in plaintext for display (e.g. "··· a1b2"). */
  last4: string;
  /** Optional label like "Personal OpenAI". */
  name: string;
  /** When true, this is the key the resolver uses. Exactly ONE active per USER —
   *  activating any key deactivates all the user's other keys (enforced in routes). */
  isActive: boolean;
  /** Optional override of the default model for this provider. */
  modelOverride: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiProviderConfigSchema = new Schema<IAIProviderConfig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // No enum: the gateway routes to many more providers than the curated set.
    provider: { type: String, required: true },
    encryptedKey: { type: String, required: true },
    last4: { type: String, default: "" },
    name: { type: String, default: "", trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },
    modelOverride: { type: String, default: null, trim: true },
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
  }
);

aiProviderConfigSchema.index({ userId: 1, provider: 1, isActive: 1 });

export const AIProviderConfig = mongoose.model<IAIProviderConfig>("AIProviderConfig", aiProviderConfigSchema);
