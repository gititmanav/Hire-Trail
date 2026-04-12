import { Router } from "express";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { userRoleSchema } from "../../validators/admin.js";
import { ForbiddenError, NotFoundError } from "../../errors/AppError.js";
const router = Router();
/** GET / — paginated user list with search and filters */
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const search = req.query.search || "";
        const roleFilter = req.query.role;
        const sortField = req.query.sort || "createdAt";
        const sortOrder = req.query.order === "asc" ? 1 : -1;
        const filter = {};
        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [{ name: regex }, { email: regex }];
        }
        if (roleFilter && ["user", "admin"].includes(roleFilter)) {
            filter.role = roleFilter;
        }
        const [users, total] = await Promise.all([
            User.find(filter)
                .setOptions({ includeDeleted: true })
                .sort({ [sortField]: sortOrder })
                .skip((page - 1) * limit)
                .limit(limit)
                .select("name email role suspended suspendedAt deleted deletedAt createdAt updatedAt")
                .lean(),
            User.countDocuments(filter).setOptions({ includeDeleted: true }),
        ]);
        // Enrich with counts
        const userIds = users.map((u) => u._id);
        const [appCounts, resumeCounts, lastLogins] = await Promise.all([
            Application.aggregate([
                { $match: { userId: { $in: userIds } } },
                { $group: { _id: "$userId", count: { $sum: 1 } } },
            ]),
            Resume.aggregate([
                { $match: { userId: { $in: userIds } } },
                { $group: { _id: "$userId", count: { $sum: 1 } } },
            ]),
            AdminLoginEvent.aggregate([
                { $match: { userId: { $in: userIds } } },
                { $sort: { loggedInAt: -1 } },
                { $group: { _id: "$userId", lastLogin: { $first: "$loggedInAt" } } },
            ]),
        ]);
        const appCountMap = new Map(appCounts.map((a) => [a._id.toString(), a.count]));
        const resumeCountMap = new Map(resumeCounts.map((r) => [r._id.toString(), r.count]));
        const lastLoginMap = new Map(lastLogins.map((l) => [l._id.toString(), l.lastLogin]));
        const enriched = users.map((u) => ({
            ...u,
            applicationCount: appCountMap.get(u._id.toString()) || 0,
            resumeCount: resumeCountMap.get(u._id.toString()) || 0,
            lastLogin: lastLoginMap.get(u._id.toString()) || null,
        }));
        res.json({
            data: enriched,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
});
/** GET /export — CSV export of all users */
router.get("/export", async (_req, res, next) => {
    try {
        const users = await User.find({})
            .setOptions({ includeDeleted: true })
            .select("name email role suspended deleted createdAt")
            .sort({ createdAt: -1 })
            .lean();
        const header = "Name,Email,Role,Suspended,Deleted,Joined\n";
        const rows = users.map((u) => `"${u.name}","${u.email}","${u.role}",${u.suspended},${u.deleted},"${u.createdAt.toISOString()}"`).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=users-export.csv");
        res.send(header + rows);
    }
    catch (err) {
        next(err);
    }
});
/** GET /:id — single user detail */
router.get("/:id", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .setOptions({ includeDeleted: true })
            .select("-password -__v")
            .lean();
        if (!user)
            throw new NotFoundError("User");
        const [appCount, resumeCount, contactCount, deadlineCount, lastLogin] = await Promise.all([
            Application.countDocuments({ userId: user._id }),
            Resume.countDocuments({ userId: user._id }),
            Contact.countDocuments({ userId: user._id }),
            Deadline.countDocuments({ userId: user._id }),
            AdminLoginEvent.findOne({ userId: user._id }).sort({ loggedInAt: -1 }).lean(),
        ]);
        res.json({
            ...user,
            applicationCount: appCount,
            resumeCount,
            contactCount,
            deadlineCount,
            lastLogin: lastLogin?.loggedInAt || null,
        });
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:id/role — change user role */
router.put("/:id/role", validate(userRoleSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        if (req.params.id === admin._id.toString()) {
            throw new ForbiddenError("Cannot change your own role");
        }
        const user = await User.findById(req.params.id).setOptions({ includeDeleted: true });
        if (!user)
            throw new NotFoundError("User");
        const oldRole = user.role;
        user.role = req.body.role;
        await user.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "role_change", resourceType: "user",
            resourceId: user._id, oldValue: { role: oldRole }, newValue: { role: req.body.role },
            ipAddress, userAgent,
        });
        res.json({ message: "Role updated", user: { _id: user._id, name: user.name, role: user.role } });
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:id/suspend */
router.put("/:id/suspend", async (req, res, next) => {
    try {
        const admin = getUser(req);
        if (req.params.id === admin._id.toString()) {
            throw new ForbiddenError("Cannot suspend yourself");
        }
        const user = await User.findById(req.params.id);
        if (!user)
            throw new NotFoundError("User");
        user.suspended = true;
        user.suspendedAt = new Date();
        await user.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "suspend", resourceType: "user",
            resourceId: user._id, ipAddress, userAgent,
        });
        res.json({ message: "User suspended" });
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:id/unsuspend */
router.put("/:id/unsuspend", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const user = await User.findById(req.params.id);
        if (!user)
            throw new NotFoundError("User");
        user.suspended = false;
        user.suspendedAt = null;
        await user.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "unsuspend", resourceType: "user",
            resourceId: user._id, ipAddress, userAgent,
        });
        res.json({ message: "User unsuspended" });
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:id — soft delete */
router.delete("/:id", async (req, res, next) => {
    try {
        const admin = getUser(req);
        if (req.params.id === admin._id.toString()) {
            throw new ForbiddenError("Cannot delete yourself");
        }
        const user = await User.findById(req.params.id);
        if (!user)
            throw new NotFoundError("User");
        user.deleted = true;
        user.deletedAt = new Date();
        await user.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "delete", resourceType: "user",
            resourceId: user._id, ipAddress, userAgent,
        });
        res.json({ message: "User soft-deleted" });
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:id/hard — permanent delete including all data */
router.delete("/:id/hard", async (req, res, next) => {
    try {
        const admin = getUser(req);
        if (req.params.id === admin._id.toString()) {
            throw new ForbiddenError("Cannot delete yourself");
        }
        const user = await User.findById(req.params.id).setOptions({ includeDeleted: true });
        if (!user)
            throw new NotFoundError("User");
        // Delete all user data
        await Promise.all([
            Application.deleteMany({ userId: user._id }),
            Resume.deleteMany({ userId: user._id }),
            Contact.deleteMany({ userId: user._id }),
            Deadline.deleteMany({ userId: user._id }),
            AdminLoginEvent.deleteMany({ userId: user._id }),
        ]);
        await User.deleteOne({ _id: user._id });
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "hard_delete", resourceType: "user",
            resourceId: user._id, metadata: { deletedEmail: user.email },
            ipAddress, userAgent,
        });
        res.json({ message: "User and all data permanently deleted" });
    }
    catch (err) {
        next(err);
    }
});
/** POST /:id/impersonate — start impersonation session */
router.post("/:id/impersonate", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const target = await User.findById(req.params.id);
        if (!target)
            throw new NotFoundError("User");
        // Store impersonation info in session
        req.session.impersonating = {
            userId: target._id.toString(),
            adminId: admin._id.toString(),
        };
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "impersonate", resourceType: "user",
            resourceId: target._id, ipAddress, userAgent,
        });
        res.json({ message: `Now impersonating ${target.name}`, user: { _id: target._id, name: target.name, email: target.email } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=users.js.map