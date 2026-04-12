import { Router } from "express";
import { ensureAdmin } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { AdminLoginEvent } from "../models/AdminLoginEvent.js";
import { dashboardRoutes, usersRoutes, analyticsAdminRoutes, contentRoutes, storageRoutes, settingsRoutes, integrationsRoutes, announcementsRoutes, auditLogRoutes, emailTemplateRoutes, inviteRoutes, backupRoutes, rolesRoutes, performanceRoutes, seedRoutes, } from "./admin/index.js";
const router = Router();
// All admin routes require admin role
router.use(ensureAdmin);
// Sub-routers
router.use("/dashboard", dashboardRoutes);
router.use("/users", usersRoutes);
router.use("/analytics", analyticsAdminRoutes);
router.use("/content", contentRoutes);
router.use("/storage", storageRoutes);
router.use("/settings", settingsRoutes);
router.use("/integrations", integrationsRoutes);
router.use("/announcements", announcementsRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/email-templates", emailTemplateRoutes);
router.use("/invites", inviteRoutes);
router.use("/backup", backupRoutes);
router.use("/roles", rolesRoutes);
router.use("/performance", performanceRoutes);
router.use("/seed", seedRoutes);
// Backward-compatible overview endpoint
router.get("/overview", async (_req, res, next) => {
    try {
        const [totalUsers, adminUsers, recentLogins, users] = await Promise.all([
            User.countDocuments({}).setOptions({ includeDeleted: true }),
            User.countDocuments({ role: "admin" }).setOptions({ includeDeleted: true }),
            AdminLoginEvent.find({})
                .sort({ loggedInAt: -1 })
                .limit(100)
                .lean(),
            User.find({})
                .setOptions({ includeDeleted: true })
                .sort({ createdAt: -1 })
                .select("name email role createdAt updatedAt")
                .lean(),
        ]);
        res.json({
            stats: {
                totalUsers,
                adminUsers,
                regularUsers: totalUsers - adminUsers,
                totalLoginsTracked: recentLogins.length,
            },
            users,
            recentLogins,
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=admin.js.map