import { Router, Request, Response, NextFunction } from "express";
import { Notification } from "../../models/Notification.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { NotFoundError } from "../../errors/AppError.js";

const router = Router();

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

/** GET / — all notifications cross-user, paginated, filterable */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, unknown>);
    const search = (req.query.search as string) || "";
    const type = req.query.type as string;
    const read = req.query.read as string;

    const filter: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ title: regex }, { message: regex }];
    }
    if (type) filter.type = type;
    if (read === "true") filter.read = true;
    else if (read === "false") filter.read = false;

    const [data, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email")
        .populate("applicationId", "company role")
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

/** GET /stats — notification statistics */
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const [total, unread, byType, last30Days] = await Promise.all([
      Notification.countDocuments({}),
      Notification.countDocuments({ read: false }),
      Notification.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      Notification.countDocuments({ createdAt: { $gte: monthAgo } }),
    ]);
    res.json({ total, unread, byType, last30Days });
  } catch (err) { next(err); }
});

/** DELETE /:id — delete a notification */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const notif = await Notification.findByIdAndDelete(req.params.id);
    if (!notif) throw new NotFoundError("Notification");

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "delete", resourceType: "notification",
      resourceId: notif._id, metadata: { title: notif.title },
      ipAddress, userAgent,
    });

    res.json({ message: "Notification deleted" });
  } catch (err) { next(err); }
});

export default router;
