/**
 * Admin dashboard — one snapshot across the product.
 *
 * Covers: people (sign-ups, sign-ins), what they track, mailbox connections,
 * AI (own keys, Included spend, runs, assistant connections), match scores,
 * the inbox review queue, the feedback inbox, and audit activity.
 *
 * Every number leaves out soft-deleted accounts and the demo account — the
 * demo's 650 synthetic applications (re-created on every reset) would swamp
 * the real ones.
 */
import { Router, Request, Response, NextFunction } from "express";
import type { PipelineStage } from "mongoose";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { AuditLog } from "../../models/AuditLog.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AiKey } from "../../models/AiKey.js";
import { AiUsage, currentPeriod } from "../../models/AiUsage.js";
import { McpToken } from "../../models/McpToken.js";
import { EmailScanCandidate } from "../../models/EmailScanCandidate.js";
import { Feedback } from "../../models/Feedback.js";
import { includedSpend } from "../../services/ai/ledger.js";
import { AI_PROVIDERS } from "../../services/ai/providers.js";
import type { AiProviderId } from "../../services/ai/providerIds.js";

const router = Router();

const DEMO_EMAIL = "demo@hiretrail.com";
const DAY_MS = 86_400_000;

interface DailyCount { _id: string; count: number }

const perDay: PipelineStage[] = [
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
];

const mapBy = (rows: Array<{ _id: string | null; count: number }>) =>
  rows.reduce<Record<string, number>>((acc, r) => { if (r._id) acc[r._id] = r.count; return acc; }, {});

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
    const period = currentPeriod(now);

    // countDocuments skips soft-deleted users on its own (User query middleware);
    // aggregates don't, so they say it explicitly.
    const people = { email: { $ne: DEMO_EMAIL } };
    const demo = await User.findOne({ email: DEMO_EMAIL }).setOptions({ includeDeleted: true }).select("_id").lean();
    const owned = demo ? { userId: { $ne: demo._id } } : {};

    const [
      totalUsers, adminUsers, signupsToday, signupsThisWeek, signupsThisMonth, signedInIds,
      totalApplications, applicationsByStage, totalResumes, totalContacts, masterProfileUsers,
      gmailConnected, outlookConnected, anyMailboxConnected,
      ownKeyOwnerIds, ownKeysByProvider, includedSpendUsd, aiRunsThisMonth, assistantConnections,
      tailorSessionsTotal, tailorSessionsThisWeek, matchScores, scoreBuckets,
      candidatesFound, candidatesAdded,
      feedbackOpen, feedbackByType,
      recentActivity,
      userGrowth, appsPerDay, tailorPerDay, aiRunsPerDay,
    ] = await Promise.all([
      User.countDocuments(people),
      User.countDocuments({ ...people, role: "admin" }),
      User.countDocuments({ ...people, createdAt: { $gte: todayStart } }),
      User.countDocuments({ ...people, createdAt: { $gte: weekAgo } }),
      User.countDocuments({ ...people, createdAt: { $gte: monthAgo } }),
      AdminLoginEvent.distinct("userId", { loggedInAt: { $gte: weekAgo }, email: { $ne: DEMO_EMAIL } }),

      Application.countDocuments(owned),
      Application.aggregate([{ $match: owned }, { $group: { _id: "$stage", count: { $sum: 1 } } }]),
      Resume.countDocuments(owned),
      Contact.countDocuments(owned),
      MasterProfile.countDocuments(owned),

      User.countDocuments({ ...people, gmailConnected: true }),
      User.countDocuments({ ...people, outlookConnected: true }),
      User.countDocuments({ ...people, $or: [{ gmailConnected: true }, { outlookConnected: true }] }),

      AiKey.distinct("userId", { owner: "user" }),
      AiKey.aggregate<{ _id: AiProviderId; count: number }>([
        { $match: { owner: "user" } },
        { $group: { _id: "$provider", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      includedSpend(period),
      AiUsage.countDocuments({ period, status: "settled" }),
      McpToken.countDocuments({ revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }),

      TailorSession.countDocuments(owned),
      TailorSession.countDocuments({ ...owned, createdAt: { $gte: weekAgo } }),
      TailorSession.aggregate<{ count: number; avg: number }>([
        { $match: { ...owned, createdAt: { $gte: monthAgo }, matchScore: { $type: "number" } } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: "$matchScore" } } },
      ]),
      // Half-point buckets ("7.5" = [7.5, 8)): the band edges (5, 7.5) fall on
      // bucket edges, so the client bands them with utils/matchScore — the one
      // place the thresholds live.
      TailorSession.aggregate<{ _id: number; count: number }>([
        { $match: { ...owned, createdAt: { $gte: monthAgo }, matchScore: { $type: "number" } } },
        { $group: { _id: { $divide: [{ $floor: { $multiply: ["$matchScore", 2] } }, 2] }, count: { $sum: 1 } } },
      ]),

      EmailScanCandidate.countDocuments({ createdAt: { $gte: monthStart } }),
      // Imported / merged rows are final, so their updatedAt is when it happened.
      EmailScanCandidate.aggregate<{ _id: { status: "imported" | "merged"; stage: string }; count: number }>([
        { $match: { status: { $in: ["imported", "merged"] }, updatedAt: { $gte: monthStart } } },
        { $group: { _id: { status: "$status", stage: "$inferredStage" }, count: { $sum: 1 } } },
      ]),

      Feedback.countDocuments({ status: "open" }),
      Feedback.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),

      AuditLog.find({})
        .sort({ timestamp: -1 })
        .limit(20)
        .populate("userId", "name email")
        .lean(),

      User.aggregate<DailyCount>([{ $match: { ...people, deleted: { $ne: true }, createdAt: { $gte: monthAgo } } }, ...perDay]),
      Application.aggregate<DailyCount>([{ $match: { ...owned, createdAt: { $gte: monthAgo } } }, ...perDay]),
      TailorSession.aggregate<DailyCount>([{ $match: { ...owned, createdAt: { $gte: monthAgo } } }, ...perDay]),
      AiUsage.aggregate<DailyCount>([{ $match: { status: "settled", createdAt: { $gte: monthAgo } } }, ...perDay]),
    ]);

    // Distinct ids come from rows that outlive a soft delete — count the live accounts.
    const [signedInThisWeek, ownKeyUsers] = await Promise.all([
      User.countDocuments({ ...people, _id: { $in: signedInIds } }),
      User.countDocuments({ ...people, _id: { $in: ownKeyOwnerIds } }),
    ]);

    const added = { imported: 0, merged: 0, byStage: {} as Record<string, number> };
    for (const r of candidatesAdded) {
      added[r._id.status] += r.count;
      added.byStage[r._id.stage] = (added.byStage[r._id.stage] ?? 0) + r.count;
    }

    res.json({
      users: {
        total: totalUsers,
        admins: adminUsers,
        signupsToday,
        signupsThisWeek,
        signupsThisMonth,
        signedInThisWeek,
      },
      tracking: {
        applications: totalApplications,
        applicationsByStage: mapBy(applicationsByStage),
        resumes: totalResumes,
        contacts: totalContacts,
        masterProfileUsers,
      },
      mailboxes: {
        gmail: gmailConnected,
        outlook: outlookConnected,
        any: anyMailboxConnected,
      },
      ai: {
        ownKeyUsers,
        ownKeysByProvider: ownKeysByProvider.map((r) => ({ provider: r._id, label: AI_PROVIDERS[r._id]?.label ?? r._id, count: r.count })),
        includedSpendUsd,
        runsThisMonth: aiRunsThisMonth,
        assistantConnections,
      },
      fit: {
        sessionsTotal: tailorSessionsTotal,
        sessionsThisWeek: tailorSessionsThisWeek,
        scored30d: matchScores[0]?.count ?? 0,
        avgMatchScore: matchScores[0]?.avg ?? null,
        scoreBuckets: Object.fromEntries(scoreBuckets.map((b) => [String(b._id), b.count])),
      },
      inbox: {
        foundThisMonth: candidatesFound,
        importedThisMonth: added.imported,
        mergedThisMonth: added.merged,
        addedByStage: added.byStage,
      },
      feedback: {
        open: feedbackOpen,
        byType: mapBy(feedbackByType),
      },
      recentActivity,
      charts: {
        userGrowth,
        appsPerDay,
        tailorPerDay,
        aiRunsPerDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
