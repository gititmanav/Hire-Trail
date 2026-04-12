import { Router } from "express";
import { Deadline } from "../models/Deadline.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createDeadlineSchema, updateDeadlineSchema, } from "../validators/deadlines.js";
import { NotFoundError } from "../errors/AppError.js";
const router = Router();
router.use(ensureAuth);
// GET list: pagination + status filter (filter before skip/limit)
router.get("/", async (req, res, next) => {
    try {
        const user = getUser(req);
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const status = req.query.status || "all";
        const now = new Date();
        const base = { userId: user._id };
        let query = { ...base };
        if (status === "upcoming") {
            query = { ...base, completed: false, dueDate: { $gte: now } };
        }
        else if (status === "overdue") {
            query = { ...base, completed: false, dueDate: { $lt: now } };
        }
        else if (status === "completed") {
            query = { ...base, completed: true };
        }
        let sort = { dueDate: 1 };
        if (status === "completed")
            sort = { dueDate: -1 };
        const [deadlines, total, upcoming, overdue, completed] = await Promise.all([
            Deadline.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Deadline.countDocuments(query),
            Deadline.countDocuments({
                ...base,
                completed: false,
                dueDate: { $gte: now },
            }),
            Deadline.countDocuments({
                ...base,
                completed: false,
                dueDate: { $lt: now },
            }),
            Deadline.countDocuments({ ...base, completed: true }),
        ]);
        res.json({
            data: deadlines,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            counts: { upcoming, overdue, completed },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET one
router.get("/:id", async (req, res, next) => {
    try {
        const user = getUser(req);
        const deadline = await Deadline.findOne({
            _id: req.params.id,
            userId: user._id,
        }).lean();
        if (!deadline)
            throw new NotFoundError("Deadline");
        res.json(deadline);
    }
    catch (err) {
        next(err);
    }
});
// POST create
router.post("/", validate(createDeadlineSchema), async (req, res, next) => {
    try {
        const user = getUser(req);
        const data = req.body;
        const deadline = await Deadline.create({
            userId: user._id,
            applicationId: data.applicationId || null,
            type: data.type,
            dueDate: new Date(data.dueDate),
            notes: data.notes,
        });
        res.status(201).json(deadline);
    }
    catch (err) {
        next(err);
    }
});
// PUT update
router.put("/:id", validate(updateDeadlineSchema), async (req, res, next) => {
    try {
        const user = getUser(req);
        const data = { ...req.body };
        if (data.dueDate) {
            data.dueDate = new Date(data.dueDate);
        }
        const deadline = await Deadline.findOneAndUpdate({ _id: req.params.id, userId: user._id }, { $set: data }, { new: true, runValidators: true });
        if (!deadline)
            throw new NotFoundError("Deadline");
        res.json(deadline);
    }
    catch (err) {
        next(err);
    }
});
// DELETE
router.delete("/:id", async (req, res, next) => {
    try {
        const user = getUser(req);
        const result = await Deadline.findOneAndDelete({
            _id: req.params.id,
            userId: user._id,
        });
        if (!result)
            throw new NotFoundError("Deadline");
        res.json({ message: "Deadline deleted" });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=deadlines.js.map