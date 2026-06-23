/**
 * User-facing announcements.
 *
 *   GET /api/announcements/active — currently-active announcements for the
 *   signed-in user (drives the app banner + header megaphone).
 *
 * The admin panel has its own /api/admin/announcements/* (CRUD, behind
 * ensureAdmin). This route is the non-admin read path: an `/active` handler
 * existed only under the admin router, so regular users could never reach it —
 * which is why the banner never appeared.
 */
import { Router, Request, Response, NextFunction } from "express";

import { ensureAuth } from "../middleware/auth.js";
import { Announcement } from "../models/Announcement.js";

const router = Router();
router.use(ensureAuth);

router.get("/active", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ startDate: -1 })
      .select("title body type startDate endDate dismissible")
      .lean();
    res.json(announcements);
  } catch (err) {
    next(err);
  }
});

export default router;
