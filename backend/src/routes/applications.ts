import { Router, Request, Response, NextFunction } from "express";
import { Application } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createApplicationSchema, updateApplicationSchema } from "../validators/applications.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

// GET list: pagination, sort, server-side search
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 25));
    const sortField = (req.query.sort as string) || "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const search = (req.query.search as string) || "";

    const allowedSorts = ["company", "role", "stage", "applicationDate", "createdAt"];
    const sort: Record<string, 1 | -1> = {};
    sort[allowedSorts.includes(sortField) ? sortField : "createdAt"] = sortOrder;

    // Build query
    const query: any = { userId: user._id };
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ company: regex }, { role: regex }];
    }

    const skip = (page - 1) * limit;
    const [apps, total] = await Promise.all([
      Application.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Application.countDocuments(query),
    ]);

    res.json({ data: apps, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.id, userId: user._id }).lean();
    if (!app) throw new NotFoundError("Application");
    res.json(app);
  } catch (err) { next(err); }
});

// POST create
router.post("/", validate(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.create({ ...req.body, userId: user._id, resumeId: req.body.resumeId || null });
    res.status(201).json(app);
  } catch (err) { next(err); }
});

// POST bulk import
router.post("/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const { applications } = req.body;
    if (!Array.isArray(applications) || applications.length === 0) throw new ValidationError("applications must be a non-empty array");
    if (applications.length > 500) throw new ValidationError("Maximum 500 applications per import");

    const VALID_STAGES = ["Applied", "OA", "Interview", "Offer", "Rejected"];
    const docs = applications.map((app: any) => {
      if (!app.company || !app.role) throw new ValidationError("Missing company or role");
      const stage = VALID_STAGES.includes(app.stage) ? app.stage : "Applied";
      const appDate = app.applicationDate ? new Date(app.applicationDate) : new Date();
      return { userId: user._id, company: app.company.trim(), role: app.role.trim(), jobUrl: app.jobUrl?.trim() || "", applicationDate: appDate, stage, stageHistory: [{ stage, date: appDate }], notes: app.notes?.trim() || "", resumeId: null };
    });
    const result = await Application.insertMany(docs);
    res.status(201).json({ message: `Successfully imported ${result.length} applications`, count: result.length });
  } catch (err) { next(err); }
});

// PUT update
router.put("/:id", validate(updateApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const existing = await Application.findOne({ _id: req.params.id, userId: user._id });
    if (!existing) throw new NotFoundError("Application");
    const data = req.body;
    if (data.stage && data.stage !== existing.stage) { existing.stageHistory.push({ stage: data.stage, date: new Date() }); existing.stage = data.stage; }
    if (data.company !== undefined) existing.company = data.company;
    if (data.role !== undefined) existing.role = data.role;
    if (data.jobUrl !== undefined) existing.jobUrl = data.jobUrl;
    if (data.notes !== undefined) existing.notes = data.notes;
    if (data.resumeId !== undefined) existing.resumeId = data.resumeId;
    await existing.save();
    res.json(existing);
  } catch (err) { next(err); }
});

// DELETE
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const result = await Application.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!result) throw new NotFoundError("Application");
    res.json({ message: "Application deleted" });
  } catch (err) { next(err); }
});

export default router;
