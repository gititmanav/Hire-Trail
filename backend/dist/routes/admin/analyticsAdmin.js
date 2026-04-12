import { Router } from "express";
import { Application } from "../../models/Application.js";
import { User } from "../../models/User.js";
const router = Router();
/** GET /platform — platform-wide analytics */
router.get("/platform", async (_req, res, next) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const [stageFunnel, topCompanies, topRoles, totalApps, totalUsers, weeklySignups, weeklyRejections, conversionData,] = await Promise.all([
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
        ]);
        const conv = conversionData[0] || { total: 0, oa: 0, interview: 0, offer: 0, rejected: 0 };
        const avgAppsPerUser = totalUsers > 0 ? Math.round((totalApps / totalUsers) * 10) / 10 : 0;
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
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=analyticsAdmin.js.map