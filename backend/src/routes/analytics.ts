/** Aggregated metrics for the current user: funnel, resume performance, weekly trend. */
import { Router, Request, Response, NextFunction } from "express";
import { Application, STAGES } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";

const router = Router();
router.use(ensureAuth);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const userId = user._id;

    // Stage funnel counts
    const stageCounts = await Application.aggregate([
      { $match: { userId } },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]);

    const funnel: Record<string, number> = {};
    STAGES.forEach((s) => {
      funnel[s] = 0;
    });
    stageCounts.forEach((item) => {
      funnel[item._id] = item.count;
    });

    const total = Object.values(funnel).reduce((a, b) => a + b, 0);

    // Resume performance
    const resumePerformance = await Application.aggregate([
      { $match: { userId, resumeId: { $ne: null } } },
      {
        $group: {
          _id: "$resumeId",
          total: { $sum: 1 },
          responses: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["OA", "Interview", "Offer"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Weekly trend
    const weeklyTrend = await Application.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: {
            year: { $year: "$applicationDate" },
            week: { $week: "$applicationDate" },
          },
          count: { $sum: 1 },
          firstDate: { $min: "$applicationDate" },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]);

    res.json({ funnel, total, resumePerformance, weeklyTrend });
  } catch (err) {
    next(err);
  }
});

export default router;
