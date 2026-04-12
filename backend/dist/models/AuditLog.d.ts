import mongoose, { Document } from "mongoose";
export declare const AUDIT_ACTIONS: readonly ["create", "update", "delete", "login", "logout", "register", "suspend", "unsuspend", "role_change", "impersonate", "export", "seed", "seed_clear", "settings_change", "announcement_create", "announcement_update", "announcement_delete", "invite_create", "invite_delete", "template_create", "template_update", "template_delete", "hard_delete", "backup_export", "user_data_export"];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export declare const RESOURCE_TYPES: readonly ["user", "application", "resume", "contact", "deadline", "setting", "announcement", "invite", "email_template", "system"];
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
export declare const AuditLog: mongoose.Model<IAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLog, {}, {}> & IAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
