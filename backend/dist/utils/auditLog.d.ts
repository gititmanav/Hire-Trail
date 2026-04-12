import { Request } from "express";
import type { AuditAction, ResourceType } from "../models/AuditLog.js";
import mongoose from "mongoose";
interface AuditParams {
    userId: mongoose.Types.ObjectId | string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId?: mongoose.Types.ObjectId | string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
    metadata?: unknown;
}
/** Fire-and-forget audit log creation — never throws. */
export declare function logAudit(params: AuditParams): Promise<void>;
/** Extract IP address and user-agent from an Express request. */
export declare function getClientInfo(req: Request): {
    ipAddress: string;
    userAgent: string;
};
export {};
