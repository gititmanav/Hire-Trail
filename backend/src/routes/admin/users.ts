import { Router, Request, Response, NextFunction } from "express";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";
import { Notification } from "../../models/Notification.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AiKey } from "../../models/AiKey.js";
import { getUser } from "../../middleware/auth.js";
import { purgeUser } from "../../services/account/deletion.js";
import { searchRegex } from "../../utils/regex.js";
import { toCsv } from "../../utils/csv.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { userRoleSchema } from "../../validators/admin.js";
import { ForbiddenError, NotFoundError } from "../../errors/AppError.js";
import type { IUser } from "../../models/User.js";

const router = Router();

const DEMO_EMAIL = "demo@hiretrail.com";
const SORTABLE = new Set(["createdAt", "updatedAt", "name", "email", "role"]);

/** What no admin may do to an account, whoever asks: change the shared demo
 *  account (every visitor signs into it — promoting it would hand anyone admin),
 *  or take away the last working admin. `removesAdmin` = demoting, suspending
 *  or deleting an admin. */
async function assertMayChange(target: IUser, removesAdmin: boolean): Promise<void> {
  if (target.email === DEMO_EMAIL) {
    throw new ForbiddenError("The demo account is shared by every visitor, so it can't be changed here.");
  }
  if (removesAdmin && target.role === "admin") {
    const others = await User.countDocuments({ role: "admin", _id: { $ne: target._id }, suspended: { $ne: true } });
    if (others === 0) throw new ForbiddenError("HireTrail needs at least one working admin. Make someone else an admin first.");
  }
}

/** GET / — paginated user list with search and filters */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const regex = searchRegex(req.query.search);
    const roleFilter = req.query.role as string;
    const sortField = SORTABLE.has(req.query.sort as string) ? (req.query.sort as string) : "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const filter: Record<string, unknown> = {};
    if (regex) filter.$or = [{ name: regex }, { email: regex }];
    if (roleFilter && ["user", "admin"].includes(roleFilter)) {
      filter.role = roleFilter;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .setOptions({ includeDeleted: true })
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("name email role suspended suspendedAt deleted deletedAt deletion createdAt updatedAt gmailConnected outlookConnected gmailEmail outlookEmail")
        .lean(),
      User.countDocuments(filter).setOptions({ includeDeleted: true }),
    ]);

    // Enrich with counts across all per-user entities (app, resume, master profile, tailor, own AI keys).
    const userIds = users.map((u) => u._id);
    const [
      appCounts, resumeCounts, lastLogins,
      masterProfileUserIds, tailorCounts, aiKeyCounts,
    ] = await Promise.all([
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
      MasterProfile.distinct("userId", { userId: { $in: userIds } }),
      TailorSession.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]),
      AiKey.aggregate([
        { $match: { owner: "user", userId: { $in: userIds } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]),
    ]);

    const appCountMap = new Map(appCounts.map((a) => [a._id.toString(), a.count]));
    const resumeCountMap = new Map(resumeCounts.map((r) => [r._id.toString(), r.count]));
    const lastLoginMap = new Map(lastLogins.map((l) => [l._id.toString(), l.lastLogin]));
    const masterProfileSet = new Set(masterProfileUserIds.map((id) => id.toString()));
    const tailorCountMap = new Map(tailorCounts.map((t) => [t._id.toString(), t.count]));
    const aiKeyCountMap = new Map(aiKeyCounts.map((k) => [k._id.toString(), k.count]));

    const enriched = users.map((u) => ({
      ...u,
      applicationCount: appCountMap.get(u._id.toString()) || 0,
      resumeCount: resumeCountMap.get(u._id.toString()) || 0,
      lastLogin: lastLoginMap.get(u._id.toString()) || null,
      hasMasterProfile: masterProfileSet.has(u._id.toString()),
      tailorSessionCount: tailorCountMap.get(u._id.toString()) || 0,
      aiKeyCount: aiKeyCountMap.get(u._id.toString()) || 0,
    }));

    res.json({
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /export — CSV export of all users */
router.get("/export", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find({})
      .setOptions({ includeDeleted: true })
      .select("name email role suspended deleted createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const csv = toCsv([
      ["Name", "Email", "Role", "Suspended", "Deleted", "Joined"],
      ...users.map((u) => [u.name, u.email, u.role, Boolean(u.suspended), Boolean(u.deleted), u.createdAt]),
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=users-export.csv");
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/** GET /:id — single user detail (an allow-list: mailbox refresh tokens and
 *  password hashes never reach the browser) */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id)
      .setOptions({ includeDeleted: true })
      .select("name email role suspended suspendedAt deleted deletedAt deletion createdAt updatedAt gmailConnected gmailEmail gmailLastSyncAt outlookConnected outlookEmail outlookLastSyncAt")
      .lean();
    if (!user) throw new NotFoundError("User");

    const [appCount, resumeCount, contactCount, deadlineCount, lastLogin, notificationCount] = await Promise.all([
      Application.countDocuments({ userId: user._id }),
      Resume.countDocuments({ userId: user._id }),
      Contact.countDocuments({ userId: user._id }),
      Deadline.countDocuments({ userId: user._id }),
      AdminLoginEvent.findOne({ userId: user._id }).sort({ loggedInAt: -1 }).lean(),
      Notification.countDocuments({ userId: user._id }),
    ]);

    res.json({
      ...user,
      applicationCount: appCount,
      resumeCount,
      contactCount,
      deadlineCount,
      notificationCount,
      lastLogin: lastLogin?.loggedInAt || null,
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /:id/role — change user role */
router.put("/:id/role", validate(userRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    if (req.params.id === admin._id.toString()) {
      throw new ForbiddenError("Cannot change your own role");
    }

    const user = await User.findById(req.params.id).setOptions({ includeDeleted: true });
    if (!user) throw new NotFoundError("User");
    await assertMayChange(user, req.body.role !== "admin");

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
  } catch (err) {
    next(err);
  }
});

/** PUT /:id/suspend */
router.put("/:id/suspend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    if (req.params.id === admin._id.toString()) {
      throw new ForbiddenError("Cannot suspend yourself");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError("User");
    await assertMayChange(user, true);

    user.suspended = true;
    user.suspendedAt = new Date();
    await user.save();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "suspend", resourceType: "user",
      resourceId: user._id, ipAddress, userAgent,
    });

    res.json({ message: "User suspended" });
  } catch (err) {
    next(err);
  }
});

/** PUT /:id/unsuspend */
router.put("/:id/unsuspend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError("User");
    await assertMayChange(user, false);

    user.suspended = false;
    user.suspendedAt = null;
    await user.save();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "unsuspend", resourceType: "user",
      resourceId: user._id, ipAddress, userAgent,
    });

    res.json({ message: "User unsuspended" });
  } catch (err) {
    next(err);
  }
});

/** DELETE /:id — soft delete */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    if (req.params.id === admin._id.toString()) {
      throw new ForbiddenError("Cannot delete yourself");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError("User");
    await assertMayChange(user, true);

    user.deleted = true;
    user.deletedAt = new Date();
    await user.save();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "delete", resourceType: "user",
      resourceId: user._id, ipAddress, userAgent,
    });

    res.json({ message: "User soft-deleted" });
  } catch (err) {
    next(err);
  }
});

/** DELETE /:id/hard — permanent delete including all data */
router.delete("/:id/hard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    if (req.params.id === admin._id.toString()) {
      throw new ForbiddenError("Cannot delete yourself");
    }

    const user = await User.findById(req.params.id).setOptions({ includeDeleted: true });
    if (!user) throw new NotFoundError("User");
    await assertMayChange(user, true);

    // The same complete erase as a self-service deletion: tracker, files,
    // profile, AI keys and usage, assistant tokens, inbox scans, sessions, and
    // Google's access to the mailbox — then the user document.
    await purgeUser(user._id);

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "hard_delete", resourceType: "user",
      resourceId: user._id, metadata: { deletedEmail: user.email },
      ipAddress, userAgent,
    });

    res.json({ message: "User and all data permanently deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
