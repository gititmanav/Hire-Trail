import { Router } from "express";
import { Application } from "../../models/Application.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { Resume } from "../../models/Resume.js";
const router = Router();
function getPagination(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    return { page, limit, skip: (page - 1) * limit };
}
/** GET /applications — cross-user application search */
router.get("/applications", async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const search = req.query.search || "";
        const stage = req.query.stage;
        const filter = {};
        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [{ company: regex }, { role: regex }];
        }
        if (stage)
            filter.stage = stage;
        const [data, total] = await Promise.all([
            Application.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name email")
                .lean(),
            Application.countDocuments(filter),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** GET /contacts — cross-user contact search */
router.get("/contacts", async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const search = req.query.search || "";
        const filter = {};
        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [{ name: regex }, { company: regex }, { role: regex }];
        }
        const [data, total] = await Promise.all([
            Contact.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name email")
                .lean(),
            Contact.countDocuments(filter),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** GET /deadlines — cross-user deadline search */
router.get("/deadlines", async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const status = req.query.status;
        const filter = {};
        const now = new Date();
        if (status === "upcoming") {
            filter.completed = false;
            filter.dueDate = { $gte: now };
        }
        else if (status === "overdue") {
            filter.completed = false;
            filter.dueDate = { $lt: now };
        }
        else if (status === "completed") {
            filter.completed = true;
        }
        const [data, total] = await Promise.all([
            Deadline.find(filter)
                .sort({ dueDate: status === "completed" ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name email")
                .populate("applicationId", "company role")
                .lean(),
            Deadline.countDocuments(filter),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** GET /resumes — cross-user resume search */
router.get("/resumes", async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const search = req.query.search || "";
        const filter = {};
        if (search) {
            const regex = new RegExp(search, "i");
            filter.$or = [{ name: regex }, { targetRole: regex }];
        }
        const [data, total] = await Promise.all([
            Resume.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name email")
                .lean(),
            Resume.countDocuments(filter),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=content.js.map