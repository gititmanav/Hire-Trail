import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User.js";
import { Notification } from "../../models/Notification.js";
import { scanUserInbox as scanGmail, disconnectGmail } from "../../services/gmailService.js";
import { scanUserInbox as scanOutlook, disconnectOutlook } from "../../services/outlookService.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { NotFoundError } from "../../errors/AppError.js";

const router = Router();

type Provider = "gmail" | "outlook";
const SIGNAL_TYPES = [
  "rejection_detected",
  "interview_detected",
  "offer_detected",
  "follow_up_detected",
] as const;

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

function parseProvider(value: unknown): Provider | "all" {
  return value === "gmail" || value === "outlook" ? value : "all";
}

/** GET /users — mailbox-connected users (any provider) */
router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, unknown>);
    const search = (req.query.search as string) || "";
    const provider = parseProvider(req.query.provider);

    const filter: Record<string, unknown> = {};
    if (provider === "gmail") filter.gmailConnected = true;
    else if (provider === "outlook") filter.outlookConnected = true;
    else filter.$or = [{ gmailConnected: true }, { outlookConnected: true }];

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchClause = [{ name: regex }, { email: regex }, { gmailEmail: regex }, { outlookEmail: regex }];
      if (filter.$or) {
        const base = filter.$or as Record<string, unknown>[];
        delete filter.$or;
        filter.$and = [{ $or: base }, { $or: searchClause }];
      } else {
        filter.$or = searchClause;
      }
    }

    const [data, total] = await Promise.all([
      User.find(filter)
        .select("name email gmailConnected gmailEmail gmailLastSyncAt outlookConnected outlookEmail outlookLastSyncAt createdAt")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

/** GET /stats — combined mailbox adoption + signal stats */
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      gmailConnected,
      outlookConnected,
      bothConnected,
      anyConnected,
      rejections,
      interviews,
      offers,
      followUps,
      signalsToday,
    ] = await Promise.all([
      User.countDocuments({ gmailConnected: true }),
      User.countDocuments({ outlookConnected: true }),
      User.countDocuments({ gmailConnected: true, outlookConnected: true }),
      User.countDocuments({ $or: [{ gmailConnected: true }, { outlookConnected: true }] }),
      Notification.countDocuments({ type: "rejection_detected" }),
      Notification.countDocuments({ type: "interview_detected" }),
      Notification.countDocuments({ type: "offer_detected" }),
      Notification.countDocuments({ type: "follow_up_detected" }),
      Notification.countDocuments({ type: { $in: SIGNAL_TYPES as unknown as string[] }, createdAt: { $gte: todayStart } }),
    ]);

    res.json({
      providers: {
        gmailConnected,
        outlookConnected,
        bothConnected,
        anyConnected,
      },
      signals: { rejections, interviews, offers, followUps },
      signalsToday,
    });
  } catch (err) { next(err); }
});

/** POST /:userId/scan?provider=gmail|outlook — admin-triggered scan */
router.post("/:userId/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const provider = parseProvider(req.query.provider);
    if (provider === "all") return res.status(400).json({ error: "Specify provider=gmail|outlook" });

    const user = await User.findById(req.params.userId);
    if (!user) throw new NotFoundError("User");

    let result: { scanned: number; applied: number };
    if (provider === "gmail") {
      if (!user.gmailConnected) return res.status(400).json({ error: "User does not have Gmail connected" });
      result = await scanGmail(user);
    } else {
      if (!user.outlookConnected) return res.status(400).json({ error: "User does not have Outlook connected" });
      result = await scanOutlook(user);
    }
    const { scanned, applied } = result;

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "update", resourceType: "user",
      resourceId: user._id, metadata: { action: `${provider}_scan`, scanned, applied },
      ipAddress, userAgent,
    });

    res.json({ message: `Scan complete. ${applied} signal(s) detected.`, scanned, applied });
  } catch (err) { next(err); }
});

/** POST /:userId/disconnect?provider=gmail|outlook — admin disconnect */
router.post("/:userId/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const provider = parseProvider(req.query.provider);
    if (provider === "all") return res.status(400).json({ error: "Specify provider=gmail|outlook" });

    const user = await User.findById(req.params.userId);
    if (!user) throw new NotFoundError("User");

    if (provider === "gmail") await disconnectGmail(user._id.toString());
    else await disconnectOutlook(user._id.toString());

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "update", resourceType: "user",
      resourceId: user._id, metadata: { action: `${provider}_disconnect`, userEmail: user.email },
      ipAddress, userAgent,
    });

    res.json({ message: `${provider === "gmail" ? "Gmail" : "Outlook"} disconnected for user` });
  } catch (err) { next(err); }
});

export default router;
