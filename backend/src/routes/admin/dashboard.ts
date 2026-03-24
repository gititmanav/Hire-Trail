import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { AuditLog } from "../../models/AuditLog.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";

const router = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      totalUsers,
      totalApplications,
      totalResumes,
      totalContacts,
      totalDeadlines,
      signupsToday,
      signupsThisWeek,
      signupsThisMonth,
      activeUserLogins,
      recentActivity,
      userGrowth,
      appsPerDay,
    ] = await Promise.all([
      User.countDocuments({}).setOptions({ includeDeleted: true }),
      Application.countDocuments({}),
      Resume.countDocuments({}),
      Contact.countDocuments({}),
      Deadline.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: todayStart } }).setOptions({ includeDeleted: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }).setOptions({ includeDeleted: true }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }).setOptions({ includeDeleted: true }),
      AdminLoginEvent.distinct("userId", { loggedInAt: { $gte: weekAgo } }),
      AuditLog.find({})
        .sort({ timestamp: -1 })
        .limit(20)
        .populate("userId", "name email")
        .lean(),
      // User growth: signups grouped by day for last 30 days
      User.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Applications per day for last 30 days
      Application.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      stats: {
        totalUsers,
        totalApplications,
        totalResumes,
        totalContacts,
        totalDeadlines,
        signupsToday,
        signupsThisWeek,
        signupsThisMonth,
        activeUsers7d: activeUserLogins.length,
      },
      recentActivity,
      charts: {
        userGrowth,
        appsPerDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
