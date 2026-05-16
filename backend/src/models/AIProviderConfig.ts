import mongoose, { Schema, Document } from "mongoose";

export const AI_PROVIDERS = ["anthropic", "openai", "google", "openrouter"] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export interface IAIProviderConfig extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: AIProvider;
  /** AES-GCM ciphertext via utils/encryption.ts. Never returned to clients. */
  encryptedKey: string;
  /** Optional label like "Personal OpenAI". */
  name: string;
  /** When true, this is the key used for this provider. Only one active per (user, provider). */
  isActive: boolean;
  /** Optional override of the default model for this provider. */
  modelOverride: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiProviderConfigSchema = new Schema<IAIProviderConfig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: AI_PROVIDERS, required: true },
    encryptedKey: { type: String, required: true },
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
