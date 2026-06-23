import mongoose, { Schema, Document } from "mongoose";

export const SETTING_CATEGORIES = ["general", "limits", "features", "session", "storage", "ai"] as const;
export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

export const SETTING_VALUE_TYPES = ["string", "number", "boolean", "json"] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

export interface ISystemSettings extends Document {
  key: string;
  value: unknown;
  valueType: SettingValueType;
  description: string;
  category: SettingCategory;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    valueType: { type: String, enum: SETTING_VALUE_TYPES, default: "string" },
    description: { type: String, default: "" },
    category: { type: String, enum: SETTING_CATEGORIES, default: "general" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

systemSettingsSchema.index({ category: 1 });

export const SystemSettings = mongoose.model<ISystemSettings>("SystemSettings", systemSettingsSchema);

/** Default settings seeded on first access */
export const DEFAULT_SETTINGS: Array<{
  key: string;
  value: unknown;
  valueType: SettingValueType;
  description: string;
  category: SettingCategory;
}> = [
  { key: "max_upload_size_mb", value: 10, valueType: "number", description: "Maximum file upload size in MB", category: "limits" },
  { key: "allowed_file_types", value: "application/pdf", valueType: "string", description: "Comma-separated MIME types for uploads", category: "limits" },
  { key: "auth_rate_limit", value: 20, valueType: "number", description: "Max auth attempts per 15 minutes", category: "limits" },
  { key: "api_rate_limit", value: 100, valueType: "number", description: "Max API requests per minute", category: "limits" },
  { key: "session_ttl_hours", value: 168, valueType: "number", description: "Session time-to-live in hours", category: "session" },
  { key: "default_page_size", value: 25, valueType: "number", description: "Default pagination page size", category: "general" },
  { key: "feature_google_oauth", value: true, valueType: "boolean", description: "Enable Google OAuth login", category: "features" },
  { key: "feature_job_search", value: true, valueType: "boolean", description: "Enable JSearch job search integration", category: "features" },
  { key: "feature_cloudinary_uploads", value: true, valueType: "boolean", description: "Enable Cloudinary file uploads", category: "features" },
  { key: "feature_csv_import_export", value: true, valueType: "boolean", description: "Enable CSV import/export", category: "features" },
  { key: "feature_kanban", value: true, valueType: "boolean", description: "Enable Kanban board view", category: "features" },
  { key: "maintenance_mode", value: false, valueType: "boolean", description: "Show maintenance page to non-admin users", category: "general" },
  // --- AI platform (runtime, DB-backed). The default KEY itself is stored
  //     separately (ai_default_key_encrypted) and never returned raw. ---
  { key: "ai_enabled", value: true, valueType: "boolean", description: "Master AI switch. When OFF, users MUST bring their own key (no default-key fallback).", category: "ai" },
  { key: "ai_default_provider", value: "", valueType: "string", description: "Gateway provider id for the admin default key (e.g. 'google'). Empty = no default key.", category: "ai" },
  { key: "ai_default_model", value: "", valueType: "string", description: "Optional gateway model override for the default key (e.g. 'google/gemini-2.5-flash'). Empty = catalog default.", category: "ai" },
  { key: "ai_default_uses_gateway_credits", value: false, valueType: "boolean", description: "When true, default-key users run on Vercel AI Gateway system credits instead of a stored provider key.", category: "ai" },
  { key: "ai_default_monthly_token_limit", value: 200000, valueType: "number", description: "Per-user monthly token cap (in+out) when using the admin default key. 0 = unlimited.", category: "ai" },
  // Encrypted admin default key — REDACTED in admin GET, written only via Admin → AI.
  { key: "ai_default_key_encrypted", value: "", valueType: "string", description: "AES-GCM ciphertext of the admin default provider key. Never returned raw.", category: "ai" },
];

/** Setting keys whose values are secrets and must never be returned to clients
 *  (the generic admin settings GET redacts these to a presence boolean). */
export const REDACTED_SETTING_KEYS: readonly string[] = ["ai_default_key_encrypted"];
