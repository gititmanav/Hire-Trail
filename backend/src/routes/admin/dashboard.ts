/**
 * Admin dashboard — unified snapshot across every product surface.
 *
 * Covers: users, applications, resumes, contacts, deadlines, mailbox connections
 * (Gmail + Outlook), AI providers (BYOK), master profiles, tailor sessions,
 * the four classifier signals, feedback inbox, and audit activity.
 */
import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { AuditLog } from "../../models/AuditLog.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";
import { Notification } from "../../models/Notification.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AIProviderConfig } from "../../models/AIProviderConfig.js";
import { Feedback } from "../../models/Feedback.js";

const router = Router();

interface DailyCount { _id: string; count: number }

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const groupByDay = (collection: "User" | "Application" | "TailorSession", since: Date) => {
      const models = { User, Application, TailorSession };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (models[collection] as any).aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]) as Promise<DailyCount[]>;
    };

    const [
      // Core users
      totalUsers,
      adminUsers,
      signupsToday,
      signupsThisWeek,
      signupsThisMonth,
      activeUserLogins,

      // App tracking
      totalApplications,
      applicationsByStage,
      totalResumes,
      totalContacts,
      totalDeadlines,

      // Mailbox integrations
      gmailConnectedUsers,
      outlookConnectedUsers,

      // AI BYOK
      aiByokUsers,
      aiKeysByProvider,

      // Master profile + tailor
      masterProfileUsers,
      tailorSessionsTotal,
      tailorSessionsThisWeek,
      tailorFitDistribution,
      avgFitScoreRaw,

      // Classifier signals (last 30d)
      signalCounts,

      // Feedback inbox
      feedbackOpen,
      feedbackByType,

      // Audit + recent activity
      recentActivity,

      // Charts
      userGrowth,
      appsPerDay,
      tailorPerDay,
      rejectionsPerDay,
    ] = await Promise.all([
      User.countDocuments({}).setOptions({ includeDeleted: true }),
      User.countDocuments({ role: "admin" }).setOptions({ includeDeleted: true }),
      User.countDocuments({ createdAt: { $gte: todayStart } }).setOptions({ includeDeleted: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }).setOptions({ includeDeleted: true }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }).setOptions({ includeDeleted: true }),
      AdminLoginEvent.distinct("userId", { loggedInAt: { $gte: weekAgo } }),

      Application.countDocuments({}),
      Application.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 } } }]),
      Resume.countDocuments({}),
      Contact.countDocuments({}),
      Deadline.countDocuments({}),

      User.countDocuments({ gmailConnected: true }),
      User.countDocuments({ outlookConnected: true }),

      AIProviderConfig.distinct("userId", { isActive: true }),
      AIProviderConfig.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$provider", count: { $sum: 1 } } },
      ]),

      MasterProfile.countDocuments({}),
      TailorSession.countDocuments({}),
      TailorSession.countDocuments({ createdAt: { $gte: weekAgo } }),
      TailorSession.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        { $group: { _id: "$fitGrade", count: { $sum: 1 } } },
      ]),
      TailorSession.aggregate([
        { $match: { createdAt: { $gte: monthAgo } } },
        { $group: { _id: null, avg: { $avg: "$fitScore" } } },
      ]),

      Notification.aggregate([
        { $match: { createdAt: { $gte: monthAgo }, type: { $in: ["interview_detected", "offer_detected", "rejection_detected", "follow_up_detected"] } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),

      Feedback.countDocuments({ status: "open" }),
      Feedback.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),

      AuditLog.find({})
        .sort({ timestamp: -1 })
        .limit(20)
        .populate("userId", "name email")
        .lean(),

      groupByDay("User", monthAgo),
      groupByDay("Application", monthAgo),
      groupByDay("TailorSession", monthAgo),
      Notification.aggregate([
        { $match: { type: "rejection_detected", createdAt: { $gte: monthAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]) as Promise<DailyCount[]>,
    ]);

    const mapBy = (rows: Array<{ _id: string | null; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, r) => { if (r._id) acc[r._id] = r.count; return acc; }, {});

    res.json({
      stats: {
        // Users
        totalUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers,
        signupsToday,
        signupsThisWeek,
        signupsThisMonth,
        activeUsers7d: activeUserLogins.length,

        // App tracking
        totalApplications,
        totalResumes,
        totalContacts,
        totalDeadlines,

        // Integrations
        gmailConnectedUsers,
        outlookConnectedUsers,
        anyMailboxConnected: Math.max(gmailConnectedUsers, outlookConnectedUsers),

        // AI
        aiByokUserCount: aiByokUsers.length,

        // Master profile + tailor
        masterProfileUsers,
        tailorSessionsTotal,
        tailorSessionsThisWeek,
        avgFitScore: avgFitScoreRaw[0]?.avg ?? null,

        // Feedback
        feedbackOpen,
      },

      breakdowns: {
        applicationsByStage: mapBy(applicationsByStage),
        aiKeysByProvider: mapBy(aiKeysByProvider),
        tailorFitDistribution: mapBy(tailorFitDistribution),
        signalsThisMonth: mapBy(signalCounts),
        feedbackByType: mapBy(feedbackByType),
      },

      recentActivity,

      charts: {
        userGrowth,
        appsPerDay,
        tailorPerDay,
        rejectionsPerDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
