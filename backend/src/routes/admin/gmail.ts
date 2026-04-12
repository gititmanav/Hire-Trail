import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User.js";
import { Notification } from "../../models/Notification.js";
import { scanUserInbox, disconnectGmail } from "../../services/gmailService.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { NotFoundError } from "../../errors/AppError.js";

const router = Router();

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

/** GET /users — all Gmail-connected users */
router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, unknown>);
    const search = (req.query.search as string) || "";

    const filter: Record<string, unknown> = { gmailConnected: true };
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const [data, total] = await Promise.all([
      User.find(filter)
        .select("name email gmailConnected gmailEmail gmailLastSyncAt createdAt")
        .sort({ gmailLastSyncAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

/** GET /stats — Gmail adoption statistics */
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [gmailConnectedCount, totalRejectionsDetected, totalScansToday] = await Promise.all([
      User.countDocuments({ gmailConnected: true }),
      Notification.countDocuments({ type: "rejection_detected" }),
      Notification.countDocuments({ type: "rejection_detected", createdAt: { $gte: todayStart } }),
    ]);

    res.json({ gmailConnectedCount, totalRejectionsDetected, totalScansToday });
  } catch (err) { next(err); }
});

/** POST /:userId/scan — admin-triggered email scan */
router.post("/:userId/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const user = await User.findById(req.params.userId);
    if (!user) throw new NotFoundError("User");
    if (!user.gmailConnected) {
      return res.status(400).json({ error: "User does not have Gmail connected" });
    }

    const count = await scanUserInbox(user);

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "update", resourceType: "user",
      resourceId: user._id, metadata: { action: "gmail_scan", rejectionsFound: count },
      ipAddress, userAgent,
    });

    res.json({ message: `Scan complete. ${count} rejection(s) detected.`, count });
  } catch (err) { next(err); }
});

/** POST /:userId/disconnect — admin-disconnect a user's Gmail */
router.post("/:userId/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const user = await User.findById(req.params.userId);
    if (!user) throw new NotFoundError("User");

    await disconnectGmail(user._id.toString());

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "update", resourceType: "user",
      resourceId: user._id, metadata: { action: "gmail_disconnect", userEmail: user.email },
      ipAddress, userAgent,
    });

    res.json({ message: "Gmail disconnected for user" });
  } catch (err) { next(err); }
});

export default router;
