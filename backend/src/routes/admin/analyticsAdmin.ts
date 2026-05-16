import { Router, Request, Response, NextFunction } from "express";
import { Application } from "../../models/Application.js";
import { User } from "../../models/User.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AIProviderConfig } from "../../models/AIProviderConfig.js";
import { Notification } from "../../models/Notification.js";

const router = Router();

/** GET /platform — platform-wide analytics */
router.get("/platform", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      stageFunnel,
      topCompanies,
      topRoles,
      totalApps,
      totalUsers,
      weeklySignups,
      weeklyRejections,
      conversionData,
      tailorTotal,
      tailorLast30,
      tailorGradeBreakdown,
      tailorAvgScore,
      masterProfileTotal,
      masterProfileCoverage,
      aiProviderUsage,
      mailboxConnectedUsers,
      signalsLast30,
    ] = await Promise.all([
      // Stage funnel
      Application.aggregate([
        { $group: { _id: "$stage", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Top 10 companies
      Application.aggregate([
        { $group: { _id: "$company", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Top 10 roles
      Application.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Application.countDocuments({}),
      User.countDocuments({}).setOptions({ includeDeleted: true }),
      // Weekly signup trend (last 12 weeks)
      User.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 84 * 86400000) } } },
        {
          $group: {
            _id: { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
      ]),
      // Weekly rejection trend
      Application.aggregate([
        { $match: { stage: "Rejected", updatedAt: { $gte: new Date(Date.now() - 84 * 86400000) } } },
        {
          $group: {
            _id: { year: { $isoWeekYear: "$updatedAt" }, week: { $isoWeek: "$updatedAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
      ]),
      // Conversion rates
      Application.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            oa: { $sum: { $cond: [{ $in: ["$stage", ["OA", "Interview", "Offer"]] }, 1, 0] } },
            interview: { $sum: { $cond: [{ $in: ["$stage", ["Interview", "Offer"]] }, 1, 0] } },
            offer: { $sum: { $cond: [{ $eq: ["$stage", "Offer"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$stage", "Rejected"] }, 1, 0] } },
          },
        },
      ]),
      // Tailor totals
      TailorSession.countDocuments({}),
      TailorSession.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      TailorSession.aggregate([{ $group: { _id: "$fitGrade", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      TailorSession.aggregate([{ $group: { _id: null, avgScore: { $avg: "$fitScore" } } }]),
      // Master profile totals
      MasterProfile.countDocuments({}),
      MasterProfile.aggregate([
        {
          $project: {
            hasPersonal: { $cond: [{ $ifNull: ["$personal", false] }, 1, 0] },
            hasExperience: { $cond: [{ $gt: [{ $size: { $ifNull: ["$workExperience", []] } }, 0] }, 1, 0] },
            hasProjects: { $cond: [{ $gt: [{ $size: { $ifNull: ["$projects", []] } }, 0] }, 1, 0] },
            hasEducation: { $cond: [{ $gt: [{ $size: { $ifNull: ["$education", []] } }, 0] }, 1, 0] },
            hasSkills: { $cond: [{ $gt: [{ $size: { $ifNull: ["$skills", []] } }, 0] }, 1, 0] },
            hasCertifications: { $cond: [{ $gt: [{ $size: { $ifNull: ["$certifications", []] } }, 0] }, 1, 0] },
          },
        },
        {
          $group: {
            _id: null,
            personal: { $sum: "$hasPersonal" },
            experience: { $sum: "$hasExperience" },
            projects: { $sum: "$hasProjects" },
            education: { $sum: "$hasEducation" },
            skills: { $sum: "$hasSkills" },
            certifications: { $sum: "$hasCertifications" },
            total: { $sum: 1 },
          },
        },
      ]),
      // AI provider usage (one row per active key)
      AIProviderConfig.aggregate([
        { $match: { active: true } },
        { $group: { _id: "$provider", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Mailbox adoption
      User.countDocuments({ $or: [{ gmailConnected: true }, { outlookConnected: true }] }),
      // Email signals last 30 days
      Notification.aggregate([
        { $match: { type: { $in: ["rejection_detected", "interview_detected", "offer_detected", "follow_up_detected"] }, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
    ]);

    const conv = conversionData[0] || { total: 0, oa: 0, interview: 0, offer: 0, rejected: 0 };
    const avgAppsPerUser = totalUsers > 0 ? Math.round((totalApps / totalUsers) * 10) / 10 : 0;

    const cov = masterProfileCoverage[0] || { personal: 0, experience: 0, projects: 0, education: 0, skills: 0, certifications: 0, total: 0 };
    const covPct = (n: number) => cov.total > 0 ? Math.round((n / cov.total) * 1000) / 10 : 0;

    res.json({
      funnel: stageFunnel,
      topCompanies,
      topRoles,
      totalApplications: totalApps,
      totalUsers,
      avgAppsPerUser,
      conversionRates: {
        oaRate: conv.total > 0 ? Math.round((conv.oa / conv.total) * 1000) / 10 : 0,
        interviewRate: conv.total > 0 ? Math.round((conv.interview / conv.total) * 1000) / 10 : 0,
        offerRate: conv.total > 0 ? Math.round((conv.offer / conv.total) * 1000) / 10 : 0,
        rejectionRate: conv.total > 0 ? Math.round((conv.rejected / conv.total) * 1000) / 10 : 0,
      },
      trends: {
        weeklySignups,
        weeklyRejections,
      },
      tailor: {
        totalSessions: tailorTotal,
        last30Days: tailorLast30,
        avgFitScore: tailorAvgScore[0]?.avgScore ? Math.round(tailorAvgScore[0].avgScore * 10) / 10 : 0,
        gradeBreakdown: tailorGradeBreakdown,
      },
      masterProfile: {
        total: masterProfileTotal,
        adoptionRate: totalUsers > 0 ? Math.round((masterProfileTotal / totalUsers) * 1000) / 10 : 0,
        coverage: {
          personal: covPct(cov.personal),
          experience: covPct(cov.experience),
          projects: covPct(cov.projects),
          education: covPct(cov.education),
          skills: covPct(cov.skills),
          certifications: covPct(cov.certifications),
        },
      },
      aiProviders: aiProviderUsage,
      mailbox: {
        connectedUsers: mailboxConnectedUsers,
        adoptionRate: totalUsers > 0 ? Math.round((mailboxConnectedUsers / totalUsers) * 1000) / 10 : 0,
        signalsLast30,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
