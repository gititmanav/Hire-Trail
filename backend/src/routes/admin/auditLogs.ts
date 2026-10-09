import { Router, Request, Response, NextFunction } from "express";
import { AuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } from "../../models/AuditLog.js";
import mongoose from "mongoose";

const router = Router();

/** A date from the query string, or null — never an object or an Invalid Date. */
function dateParam(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** GET / — paginated, filterable audit logs */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const { action, resourceType, userId, startDate, endDate } = req.query;

    const filter: Record<string, unknown> = {};
    // Known values only — a raw query value could be an operator object (?action[$ne]=).
    if ((AUDIT_ACTIONS as readonly unknown[]).includes(action)) filter.action = action;
    if ((RESOURCE_TYPES as readonly unknown[]).includes(resourceType)) filter.resourceType = resourceType;
    if (userId && mongoose.isValidObjectId(userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(userId as string);
    }
    const start = dateParam(startDate);
    const end = dateParam(endDate);
    if (start || end) {
      filter.timestamp = {};
      if (start) (filter.timestamp as Record<string, unknown>).$gte = start;
      if (end) (filter.timestamp as Record<string, unknown>).$lte = end;
    }

    const [data, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email")
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

export default router;
