import mongoose, { Schema } from "mongoose";
export const SETTING_CATEGORIES = ["general", "limits", "features", "session", "storage"];
export const SETTING_VALUE_TYPES = ["string", "number", "boolean", "json"];
const systemSettingsSchema = new Schema({
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    valueType: { type: String, enum: SETTING_VALUE_TYPES, default: "string" },
    description: { type: String, default: "" },
    category: { type: String, enum: SETTING_CATEGORIES, default: "general" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });
systemSettingsSchema.index({ category: 1 });
export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
/** Default settings seeded on first access */
export const DEFAULT_SETTINGS = [
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
];
//# sourceMappingURL=SystemSettings.js.map