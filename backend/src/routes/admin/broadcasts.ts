/**
 * Admin broadcast emails.
 *
 *   GET    /api/admin/broadcasts            — paginated list of past broadcasts
 *   GET    /api/admin/broadcasts/status     — mailer configuration status
 *   GET    /api/admin/broadcasts/recipients — preview recipient count
 *   GET    /api/admin/broadcasts/:id        — one broadcast with failure detail
 *   POST   /api/admin/broadcasts            — send a new broadcast
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { getUser } from "../../middleware/auth.js";
import { User } from "../../models/User.js";
import { BroadcastEmail, BROADCAST_RECIPIENT_TYPES } from "../../models/BroadcastEmail.js";
import { NotFoundError } from "../../errors/AppError.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { sendEmail, htmlToText, isMailerConfigured, getMailerStatus } from "../../services/mailer.js";

const router = Router();

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().min(1).max(200_000),
  recipientType: z.enum(BROADCAST_RECIPIENT_TYPES),
  userIds: z.array(z.string()).optional(),
});

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

/** GET /status — whether SMTP is configured */
router.get("/status", (_req, res) => {
  res.json(getMailerStatus());
});

/** GET /recipients?type=all — count of users who would receive the email */
router.get("/recipients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string;
    const filter: Record<string, unknown> = { suspended: { $ne: true }, email: { $ne: null } };
    if (type === "all") {
      const count = await User.countDocuments(filter);
      res.json({ count });
      return;
    }
    res.status(400).json({ error: "Specify type=all" });
  } catch (err) { next(err); }
});

/** GET / — paginated list of past broadcasts */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, unknown>);
    const [data, total] = await Promise.all([
      BroadcastEmail.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sentByUserId", "name email")
        .select("-bodyHtml -failedEmails")
        .lean(),
      BroadcastEmail.countDocuments({}),
    ]);
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

/** GET /:id — detailed view (includes body + failed list) */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const broadcast = await BroadcastEmail.findById(req.params.id)
      .populate("sentByUserId", "name email")
      .lean();
    if (!broadcast) throw new NotFoundError("Broadcast");
    res.json(broadcast);
  } catch (err) { next(err); }
});

/** POST / — send a broadcast */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Email sender is not configured. Set EMAIL_APP_PASSWORD in env." });
      return;
    }

    const admin = getUser(req);
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const { subject, bodyHtml, recipientType, userIds } = parsed.data;

    // Resolve recipients
    const baseFilter: Record<string, unknown> = { suspended: { $ne: true }, email: { $ne: null } };
    let recipients: { _id: mongoose.Types.ObjectId; email: string; name: string }[];
    if (recipientType === "all") {
      recipients = await User.find(baseFilter).select("_id email name").lean() as typeof recipients;
    } else {
      if (!userIds || userIds.length === 0) {
        res.status(400).json({ error: "userIds is required when recipientType is 'selected'" });
        return;
      }
      const objectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
      recipients = await User.find({ ...baseFilter, _id: { $in: objectIds } }).select("_id email name").lean() as typeof recipients;
    }

    if (recipients.length === 0) {
      res.status(400).json({ error: "No eligible recipients" });
      return;
    }

    const broadcast = await BroadcastEmail.create({
      subject,
      bodyHtml,
      recipientType,
      recipientUserIds: recipients.map((r) => r._id),
      sentByUserId: admin._id,
      status: "sending",
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      failedEmails: [],
      startedAt: new Date(),
    });

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "broadcast_send", resourceType: "broadcast",
      resourceId: broadcast._id,
      metadata: { subject, recipientType, totalRecipients: recipients.length },
      ipAddress, userAgent,
    });

    // Respond immediately; deliver in the background. The page polls /:id for progress.
    res.status(202).json({
      id: broadcast._id,
      totalRecipients: recipients.length,
      status: "sending",
    });

    const textFallback = htmlToText(bodyHtml);
    const failedEmails: { email: string; error: string }[] = [];
    let sent = 0;

    // Sequential send to stay under Gmail SMTP rate limits.
    for (const r of recipients) {
      try {
        await sendEmail({
          to: r.email,
          subject,
          html: bodyHtml,
          text: textFallback,
        });
        sent++;
      } catch (err) {
        failedEmails.push({ email: r.email, error: (err as Error).message || "Unknown error" });
      }
    }

    const status: "completed" | "partial" | "failed" =
      failedEmails.length === 0 ? "completed"
      : sent === 0 ? "failed"
      : "partial";

    await BroadcastEmail.findByIdAndUpdate(broadcast._id, {
      $set: {
        status,
        sentCount: sent,
        failedCount: failedEmails.length,
        failedEmails: failedEmails.slice(0, 200),
        completedAt: new Date(),
      },
    });
  } catch (err) { next(err); }
});

export default router;
