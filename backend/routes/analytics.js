import { Router } from "express";
import { getDB } from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();

router.use(ensureAuth);

// GET full analytics for current user
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user._id.toString();

    // Stage funnel counts
    const stageCounts = await db
      .collection("applications")
      .aggregate([
        { $match: { userId } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ])
      .toArray();

    const stages = ["Applied", "OA", "Interview", "Offer", "Rejected"];
    const funnel = {};
    stages.forEach((s) => {
      funnel[s] = 0;
    });
    stageCounts.forEach((item) => {
      funnel[item._id] = item.count;
    });

    const total = Object.values(funnel).reduce((a, b) => a + b, 0);

    // Resume performance — response rate per resume version
    const resumePerformance = await db
      .collection("applications")
      .aggregate([
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
      ])
      .toArray();

    // Weekly application trend
    const weeklyTrend = await db
      .collection("applications")
      .aggregate([
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
      ])
      .toArray();

    return res.json({
      funnel,
      total,
      resumePerformance,
      weeklyTrend,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
