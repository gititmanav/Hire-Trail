import { Request } from "express";
import { AuditLog } from "../models/AuditLog.js";
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
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await AuditLog.create({
      timestamp: new Date(),
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      ipAddress: params.ipAddress || "",
      userAgent: params.userAgent || "",
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}

/** Extract IP address and user-agent from an Express request. */
export function getClientInfo(req: Request): { ipAddress: string; userAgent: string } {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "";
  const userAgent = (req.headers["user-agent"] as string) || "";
  return { ipAddress, userAgent };
}
