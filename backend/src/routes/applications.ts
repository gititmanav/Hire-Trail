import { Router, Request, Response, NextFunction } from "express";
import { Application } from "../models/Application.js";
import { Company } from "../models/Company.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createApplicationSchema, updateApplicationSchema } from "../validators/applications.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

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
    const archivedParam = req.query.archived as string;
    if (archivedParam === "true") {
      query.archived = true;
    } else if (archivedParam !== "all") {
      // Default: only show non-archived
      query.$or = [{ archived: false }, { archived: { $exists: false } }];
    }
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const searchOr = [{ company: regex }, { role: regex }];
      if (query.$or) {
        // Combine archived filter with search — use $and
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
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

// POST create (with shared-company linking)
router.post("/", validate(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    // Find-or-create shared company
    let companyId = req.body.companyId || null;
    if (!companyId && req.body.company) {
      const domain = req.body.jobUrl ? extractDomain(req.body.jobUrl) : "";
      const company = await Company.findOneAndUpdate(
        { name: req.body.company.trim() },
        {
          $setOnInsert: { name: req.body.company.trim(), website: req.body.jobUrl ? new URL(req.body.jobUrl).origin : "", domain, createdBy: user._id },
          $addToSet: { users: user._id },
        },
        { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
      );
      companyId = company._id;
    }
    // Duplicate detection: if jobUrl is non-empty, check for existing
    if (req.body.jobUrl) {
      const existing = await Application.findOne({ userId: user._id, jobUrl: req.body.jobUrl });
      if (existing) {
        return res.status(409).json({ error: "Already tracked", applicationId: existing._id });
      }
    }
    const app = await Application.create({ ...req.body, userId: user._id, companyId, resumeId: req.body.resumeId || null });
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
    if (data.company !== undefined) {
      existing.company = data.company;
      // Re-link shared company if name changed
      const domain = data.jobUrl ? extractDomain(data.jobUrl) : (existing.jobUrl ? extractDomain(existing.jobUrl) : "");
      const company = await Company.findOneAndUpdate(
        { name: data.company.trim() },
        {
          $setOnInsert: { name: data.company.trim(), website: "", domain, createdBy: user._id },
          $addToSet: { users: user._id },
        },
        { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
      );
      existing.companyId = company._id;
    }
    if (data.role !== undefined) existing.role = data.role;
    if (data.jobUrl !== undefined) existing.jobUrl = data.jobUrl;
    if (data.jobDescription !== undefined) existing.jobDescription = data.jobDescription;
    if (data.location !== undefined) existing.location = data.location;
    if (data.salary !== undefined) existing.salary = data.salary;
    if (data.jobType !== undefined) existing.jobType = data.jobType;
    if (data.notes !== undefined) existing.notes = data.notes;
    if (data.resumeId !== undefined) existing.resumeId = data.resumeId;
    if (data.companyId !== undefined) existing.companyId = data.companyId;
    if (data.contactId !== undefined) existing.contactId = data.contactId;
    if (data.outreachStatus !== undefined) existing.outreachStatus = data.outreachStatus;
    if (data.archived !== undefined) existing.archived = data.archived;
    if (data.archivedAt !== undefined) existing.archivedAt = data.archivedAt ? new Date(data.archivedAt) : null;
    if (data.archivedReason !== undefined) existing.archivedReason = data.archivedReason;
    await existing.save();
    res.json(existing);
  } catch (err) { next(err); }
});

// PUT archive
router.put("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const reason = req.body?.reason || "manual";
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: { archived: true, archivedAt: new Date(), archivedReason: reason } },
      { new: true }
    );
    if (!app) throw new NotFoundError("Application");
    res.json(app);
  } catch (err) { next(err); }
});

// PUT unarchive
router.put("/:id/unarchive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: { archived: false, archivedAt: null, archivedReason: null } },
      { new: true }
    );
    if (!app) throw new NotFoundError("Application");
    res.json(app);
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
