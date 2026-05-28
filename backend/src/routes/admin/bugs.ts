/**
 * Admin bug reports — paginated triage queue + stats.
 *
 *   GET    /api/admin/bugs           — paginated list with filters
 *   GET    /api/admin/bugs/stats     — counts grouped by status / source
 *   GET    /api/admin/bugs/:id       — one report with full stack
 *   PATCH  /api/admin/bugs/:id       — update status / adminNotes
 *   DELETE /api/admin/bugs/:id       — hard delete (use sparingly)
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { getUser } from "../../middleware/auth.js";
import {
  BugReport,
  BUG_REPORT_SOURCES,
  BUG_REPORT_STATUSES,
} from "../../models/BugReport.js";
import { NotFoundError } from "../../errors/AppError.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";

const router = Router();

const updateSchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  adminNotes: z.string().max(4000).optional(),
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "25", 10)));
    const skip = (page - 1) * limit;
    const q: Record<string, unknown> = {};

    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const search = req.query.search as string | undefined;

    if (status && (BUG_REPORT_STATUSES as readonly string[]).includes(status)) q.status = status;
    if (source && (BUG_REPORT_SOURCES as readonly string[]).includes(source)) q.source = source;
    if (search?.trim()) {
      q.$or = [
        { errorMessage: { $regex: search, $options: "i" } },
        { route: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      BugReport.find(q)
        .sort({ lastSeenAt: -1 })
        // The stack + body are bulky; trim them on the list view.
        .select("-errorStack -requestBodyPreview")
        .skip(skip)
        .limit(limit)
        .lean(),
      BugReport.countDocuments(q),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, byStatus, bySource] = await Promise.all([
      BugReport.countDocuments({}),
      BugReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      BugReport.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[String(row._id)] = row.count as number;
    const sourceMap: Record<string, number> = {};
    for (const row of bySource) sourceMap[String(row._id)] = row.count as number;

    res.json({
      total,
      open: (statusMap.new || 0) + (statusMap.triaged || 0),
      byStatus: statusMap,
      bySource: sourceMap,
    });
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await BugReport.findById(req.params.id).lean();
    if (!doc) throw new NotFoundError("Bug report");
    res.json(doc);
  } catch (err) { next(err); }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const doc = await BugReport.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      { new: true },
    );
    if (!doc) throw new NotFoundError("Bug report");

    const { ipAddress, userAgent } = getClientInfo(req);
    void logAudit({
      userId: admin._id,
      action: "update",
      resourceType: "bug_report",
      resourceId: doc._id.toString(),
      ipAddress,
      userAgent,
      metadata: parsed.data,
    });

    res.json(doc);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const doc = await BugReport.findByIdAndDelete(req.params.id);
    if (!doc) throw new NotFoundError("Bug report");

    const { ipAddress, userAgent } = getClientInfo(req);
    void logAudit({
      userId: admin._id,
      action: "delete",
      resourceType: "bug_report",
      resourceId: doc._id.toString(),
      ipAddress,
      userAgent,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
