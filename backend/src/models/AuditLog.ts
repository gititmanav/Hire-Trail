import mongoose, { Schema, Document } from "mongoose";

export const AUDIT_ACTIONS = [
  "create", "update", "delete", "login", "logout", "register",
  "suspend", "unsuspend", "role_change", "impersonate",
  "export", "seed", "seed_clear", "settings_change",
  "announcement_create", "announcement_update", "announcement_delete",
  "invite_create", "invite_delete",
  "template_create", "template_update", "template_delete",
  "hard_delete", "backup_export", "user_data_export",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const RESOURCE_TYPES = [
  "user", "application", "resume", "contact", "deadline",
  "setting", "announcement", "invite", "email_template", "system",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface IAuditLog extends Document {
  timestamp: Date;
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: mongoose.Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress: string;
  userAgent: string;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
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
  },
  { timestamps: true }
);

auditLogSchema.index({ timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
