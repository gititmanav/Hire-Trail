import { Router } from "express";
import { AuditLog } from "../../models/AuditLog.js";
import mongoose from "mongoose";
const router = Router();
/** GET / — paginated, filterable audit logs */
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const { action, resourceType, userId, startDate, endDate } = req.query;
        const filter = {};
        if (action)
            filter.action = action;
        if (resourceType)
            filter.resourceType = resourceType;
        if (userId && mongoose.isValidObjectId(userId)) {
            filter.userId = new mongoose.Types.ObjectId(userId);
        }
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate)
                filter.timestamp.$gte = new Date(startDate);
            if (endDate)
                filter.timestamp.$lte = new Date(endDate);
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
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=auditLogs.js.map