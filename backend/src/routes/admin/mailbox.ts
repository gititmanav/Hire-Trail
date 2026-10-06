import { Router, Request, Response, NextFunction } from "express";
import { escapeRegex } from "../../utils/regex.js";
import { User } from "../../models/User.js";
import { EmailScanJob } from "../../models/EmailScanJob.js";
import { EmailScanCandidate } from "../../models/EmailScanCandidate.js";
import { disconnectGmail } from "../../services/gmailService.js";
import { disconnectOutlook } from "../../services/outlookService.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { NotFoundError } from "../../errors/AppError.js";

const router = Router();

type Provider = "gmail" | "outlook";

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
      const regex = new RegExp(escapeRegex(search), "i");
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

/** GET /stats — mailbox adoption, and the last 30 days of inbox scans (the
 *  review queue: what scans found, and what people imported from it). */
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [gmailConnected, outlookConnected, bothConnected, anyConnected, scans, failedScans, found, imported] = await Promise.all([
      User.countDocuments({ gmailConnected: true }),
      User.countDocuments({ outlookConnected: true }),
      User.countDocuments({ gmailConnected: true, outlookConnected: true }),
      User.countDocuments({ $or: [{ gmailConnected: true }, { outlookConnected: true }] }),
      EmailScanJob.countDocuments({ createdAt: { $gte: since } }),
      EmailScanJob.countDocuments({ createdAt: { $gte: since }, status: "failed" }),
      EmailScanCandidate.countDocuments({ createdAt: { $gte: since } }),
      EmailScanCandidate.countDocuments({ updatedAt: { $gte: since }, status: { $in: ["imported", "merged"] } }),
    ]);

    res.json({
      providers: { gmailConnected, outlookConnected, bothConnected, anyConnected },
      scans30d: { scans, failed: failedScans, found, imported },
    });
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
