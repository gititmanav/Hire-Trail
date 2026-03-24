import { Router, Request, Response, NextFunction } from "express";
import { AuditLog } from "../../models/AuditLog.js";
import mongoose from "mongoose";

const router = Router();

/** GET / — paginated, filterable audit logs */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const { action, resourceType, userId, startDate, endDate } = req.query;

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (userId && mongoose.isValidObjectId(userId as string)) {
      filter.userId = new mongoose.Types.ObjectId(userId as string);
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = new Date(startDate as string);
      if (endDate) (filter.timestamp as Record<string, unknown>).$lte = new Date(endDate as string);
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
