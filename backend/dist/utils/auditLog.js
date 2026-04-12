import { AuditLog } from "../models/AuditLog.js";
/** Fire-and-forget audit log creation — never throws. */
export async function logAudit(params) {
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
    }
    catch (err) {
        console.error("[AuditLog] Failed to write audit log:", err);
    }
}
/** Extract IP address and user-agent from an Express request. */
export function getClientInfo(req) {
    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";
    const userAgent = req.headers["user-agent"] || "";
    return { ipAddress, userAgent };
}
//# sourceMappingURL=auditLog.js.map