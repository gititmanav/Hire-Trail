import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { ValidationError } from "../errors/AppError.js";
import { buildCalendar, diffDays, MAX_RANGE_DAYS } from "../services/calendar/buildCalendar.js";
import { isYmd, safeTimeZone } from "../services/calendar/days.js";

const router = Router();
router.use(ensureAuth);

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<IANA zone>
 *   + the Applications filters (archived, search, stage, company, resumeId, source)
 *
 * Events for [from, to] (inclusive) in the viewer's zone, plus open overdue
 * deadlines, recurring sources and hover-card summaries — see
 * services/calendar/buildCalendar.ts.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    if (!isYmd(from) || !isYmd(to)) throw new ValidationError("from and to must be YYYY-MM-DD dates");
    const span = diffDays(from, to);
    if (span < 0 || span > MAX_RANGE_DAYS) throw new ValidationError(`The range must run forward and cover at most ${MAX_RANGE_DAYS} days`);
    const user = getUser(req);
    res.json(await buildCalendar(req, user._id as Types.ObjectId, { from, to, tz: safeTimeZone(req.query.tz) }));
  } catch (err) { next(err); }
});

export default router;
