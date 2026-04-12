import mongoose, { Schema } from "mongoose";
export const AUDIT_ACTIONS = [
    "create", "update", "delete", "login", "logout", "register",
    "suspend", "unsuspend", "role_change", "impersonate",
    "export", "seed", "seed_clear", "settings_change",
    "announcement_create", "announcement_update", "announcement_delete",
    "invite_create", "invite_delete",
    "template_create", "template_update", "template_delete",
    "hard_delete", "backup_export", "user_data_export",
];
export const RESOURCE_TYPES = [
    "user", "application", "resume", "contact", "deadline",
    "setting", "announcement", "invite", "email_template", "system",
];
const auditLogSchema = new Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });
auditLogSchema.index({ timestamp: -1 });
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
//# sourceMappingURL=AuditLog.js.map