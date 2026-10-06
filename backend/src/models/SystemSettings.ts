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

/** The settings the product reads — the only ones Admin → Settings shows.
 *  Seeded on first access. Older keys (upload/rate/session limits that nothing
 *  enforced, the Google-sign-in and Cloudinary switches, the gateway-era ai_*
 *  keys) stay in existing databases untouched: the AI-layer migration still
 *  reads the ai_* rows, and the categories above keep validating them. */
export const DEFAULT_SETTINGS: Array<{
  key: string;
  value: unknown;
  valueType: SettingValueType;
  description: string;
  category: SettingCategory;
}> = [
  // services/maintenance.ts
  { key: "maintenance_mode", value: false, valueType: "boolean", description: "Show maintenance page to non-admin users", category: "general" },
  // routes/settings.ts /features → hooks/useFeatureFlags (routes + sidebar)
  { key: "feature_job_search", value: true, valueType: "boolean", description: "Enable JSearch job search integration", category: "features" },
  { key: "feature_csv_import_export", value: true, valueType: "boolean", description: "Enable CSV import/export", category: "features" },
  { key: "feature_kanban", value: true, valueType: "boolean", description: "Enable Kanban board view", category: "features" },
];

/** Setting keys whose values are secrets and must never be returned to clients
 *  (the generic admin settings GET redacts these to a presence boolean). */
export const REDACTED_SETTING_KEYS: readonly string[] = ["ai_default_key_encrypted"];
