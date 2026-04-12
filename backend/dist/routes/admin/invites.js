import { Router } from "express";
import crypto from "crypto";
import { Invite } from "../../models/Invite.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { inviteSchema } from "../../validators/admin.js";
import { NotFoundError } from "../../errors/AppError.js";
const router = Router();
/** GET / — list invites */
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const [data, total] = await Promise.all([
            Invite.find({})
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("createdBy", "name email")
                .lean(),
            Invite.countDocuments({}),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** POST / — generate invite code */
router.post("/", validate(inviteSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        const code = crypto.randomBytes(16).toString("hex");
        const invite = await Invite.create({
            code,
            email: req.body.email || null,
            maxUses: req.body.maxUses,
            expiresAt: new Date(req.body.expiresAt),
            createdBy: admin._id,
        });
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "invite_create", resourceType: "invite",
            resourceId: invite._id, newValue: { code, email: req.body.email },
            ipAddress, userAgent,
        });
        res.status(201).json(invite);
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:id — deactivate invite */
router.delete("/:id", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const invite = await Invite.findById(req.params.id);
        if (!invite)
            throw new NotFoundError("Invite");
        invite.active = false;
        await invite.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "invite_delete", resourceType: "invite",
            resourceId: invite._id, oldValue: { code: invite.code },
            ipAddress, userAgent,
        });
        res.json({ message: "Invite deactivated" });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=invites.js.map