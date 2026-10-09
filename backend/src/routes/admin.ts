import { Router } from "express";
import { ensureAdmin } from "../middleware/auth.js";
import { requireSameSite } from "../middleware/sameSite.js";
import dashboardRoutes from "./admin/dashboard.js";
import usersRoutes from "./admin/users.js";
import settingsRoutes from "./admin/settings.js";
import announcementsRoutes from "./admin/announcements.js";
import auditLogRoutes from "./admin/auditLogs.js";
import seedRoutes from "./admin/seed.js";
import adminNotificationRoutes from "./admin/notifications.js";
import mailboxRoutes from "./admin/mailbox.js";
import broadcastRoutes from "./admin/broadcasts.js";
import feedbackAdminRoutes from "./admin/feedback.js";
import bugAdminRoutes from "./admin/bugs.js";
import aiAdminRoutes from "./admin/ai.js";

const router = Router();

// All admin routes require admin role, and refuse writes forged from another site.
router.use(ensureAdmin);
router.use(requireSameSite);

// Sub-routers
router.use("/dashboard", dashboardRoutes);
router.use("/users", usersRoutes);
router.use("/settings", settingsRoutes);
router.use("/announcements", announcementsRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/seed", seedRoutes);
router.use("/notifications", adminNotificationRoutes);
router.use("/mailbox", mailboxRoutes);
router.use("/broadcasts", broadcastRoutes);
router.use("/feedback", feedbackAdminRoutes);
router.use("/bugs", bugAdminRoutes);
router.use("/ai", aiAdminRoutes);

export default router;
