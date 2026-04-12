import { Router } from "express";
import { Announcement } from "../../models/Announcement.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { announcementSchema, updateAnnouncementSchema } from "../../validators/admin.js";
import { NotFoundError } from "../../errors/AppError.js";
const router = Router();
/** GET / — list announcements */
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const [data, total] = await Promise.all([
            Announcement.find({})
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("createdBy", "name email")
                .lean(),
            Announcement.countDocuments({}),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** GET /active — public endpoint for users to see active announcements */
router.get("/active", async (_req, res, next) => {
    try {
        const now = new Date();
        const announcements = await Announcement.find({
            active: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        })
            .sort({ startDate: -1 })
            .lean();
        res.json(announcements);
    }
    catch (err) {
        next(err);
    }
});
/** POST / — create announcement */
router.post("/", validate(announcementSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        const data = {
            ...req.body,
            startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
            endDate: new Date(req.body.endDate),
            createdBy: admin._id,
        };
        const announcement = await Announcement.create(data);
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "announcement_create", resourceType: "announcement",
            resourceId: announcement._id, newValue: { title: data.title },
            ipAddress, userAgent,
        });
        res.status(201).json(announcement);
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:id — update announcement */
router.put("/:id", validate(updateAnnouncementSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement)
            throw new NotFoundError("Announcement");
        const oldTitle = announcement.title;
        Object.assign(announcement, req.body);
        if (req.body.startDate)
            announcement.startDate = new Date(req.body.startDate);
        if (req.body.endDate)
            announcement.endDate = new Date(req.body.endDate);
        await announcement.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "announcement_update", resourceType: "announcement",
            resourceId: announcement._id, oldValue: { title: oldTitle },
            newValue: { title: announcement.title },
            ipAddress, userAgent,
        });
        res.json(announcement);
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:id */
router.delete("/:id", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const announcement = await Announcement.findByIdAndDelete(req.params.id);
        if (!announcement)
            throw new NotFoundError("Announcement");
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "announcement_delete", resourceType: "announcement",
            resourceId: announcement._id, oldValue: { title: announcement.title },
            ipAddress, userAgent,
        });
        res.json({ message: "Announcement deleted" });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=announcements.js.map