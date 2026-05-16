/**
 * Admin feedback inbox.
 *
 *   GET    /api/admin/feedback           — paginated list with filters
 *   GET    /api/admin/feedback/stats     — counts grouped by status / type / severity
 *   GET    /api/admin/feedback/:id       — one item with full body
 *   PATCH  /api/admin/feedback/:id       — triage: status / severity / adminNotes
 *   DELETE /api/admin/feedback/:id       — hard delete (rare; for spam)
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { getUser } from "../../middleware/auth.js";
import {
  Feedback,
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  FEEDBACK_SEVERITIES,
} from "../../models/Feedback.js";
import { NotFoundError } from "../../errors/AppError.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";

const router = Router();

const updateSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  severity: z.enum(FEEDBACK_SEVERITIES).optional(),
  adminNotes: z.string().max(4000).optional(),
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "25", 10)));
    const skip = (page - 1) * limit;
    const q: Record<string, unknown> = {};

    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const severity = req.query.severity as string | undefined;
    const search = req.query.search as string | undefined;

    if (status && (FEEDBACK_STATUSES as readonly string[]).includes(status)) q.status = status;
    if (type && (FEEDBACK_TYPES as readonly string[]).includes(type)) q.type = type;
    if (severity && (FEEDBACK_SEVERITIES as readonly string[]).includes(severity)) q.severity = severity;
    if (search?.trim()) {
      q.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      Feedback.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(q),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) { next(err); }
});

router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byType, bySeverity, total] = await Promise.all([
      Feedback.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Feedback.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      Feedback.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
      Feedback.countDocuments({}),
    ]);
    const mapBy = (rows: Array<{ _id: string; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, r) => { acc[r._id] = r.count; return acc; }, {});
    res.json({
      total,
      open: await Feedback.countDocuments({ status: "open" }),
      byStatus: mapBy(byStatus),
      byType: mapBy(byType),
      bySeverity: mapBy(bySeverity),
    });
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fb = await Feedback.findById(req.params.id).lean();
    if (!fb) throw new NotFoundError("Feedback");
    res.json(fb);
  } catch (err) { next(err); }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "resolved" || parsed.data.status === "dismissed") {
      update.resolvedById = admin._id;
      update.resolvedAt = new Date();
    } else if (parsed.data.status === "open" || parsed.data.status === "triaged" || parsed.data.status === "in_progress") {
      update.resolvedById = null;
      update.resolvedAt = null;
    }
    const fb = await Feedback.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!fb) throw new NotFoundError("Feedback");
    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "update", resourceType: "feedback",
      resourceId: fb._id, metadata: parsed.data,
      ipAddress, userAgent,
    });
    res.json(fb);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const fb = await Feedback.findByIdAndDelete(req.params.id).lean();
    if (!fb) throw new NotFoundError("Feedback");
    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "delete", resourceType: "feedback",
      resourceId: fb._id, metadata: { title: fb.title, type: fb.type },
      ipAddress, userAgent,
    });
    res.json({ message: "Deleted" });
  } catch (err) { next(err); }
});

export default router;
