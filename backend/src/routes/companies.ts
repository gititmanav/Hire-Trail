import { Router, Request, Response, NextFunction } from "express";
import { Company } from "../models/Company.js";
import { Application } from "../models/Application.js";
import { Contact } from "../models/Contact.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createCompanySchema,
  updateCompanySchema,
} from "../validators/companies.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

// GET list (paginated, searchable)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const query: any = { userId: user._id };
    if (search.trim()) {
      query.name = new RegExp(search.trim(), "i");
    }

    const [companies, total] = await Promise.all([
      Company.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(query),
    ]);

    res.json({
      data: companies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET one — includes aggregated data
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const company = await Company.findOne({
      _id: req.params.id,
      userId: user._id,
    }).lean();
    if (!company) throw new NotFoundError("Company");

    const [applications, contacts, rejectionCount] = await Promise.all([
      Application.find({ userId: user._id, companyId: company._id })
        .sort({ createdAt: -1 })
        .lean(),
      Contact.find({ userId: user._id, companyId: company._id })
        .sort({ lastContactDate: -1 })
        .lean(),
      Application.countDocuments({
        userId: user._id,
        companyId: company._id,
        stage: "Rejected",
      }),
    ]);

    // Compute average stage reached (numeric index: Applied=0, OA=1, Interview=2, Offer=3, Rejected is excluded)
    const stageOrder: Record<string, number> = { Applied: 0, OA: 1, Interview: 2, Offer: 3 };
    const nonRejected = applications.filter((a) => a.stage !== "Rejected");
    const avgStageReached =
      nonRejected.length > 0
        ? nonRejected.reduce((sum, a) => sum + (stageOrder[a.stage] ?? 0), 0) / nonRejected.length
        : 0;

    res.json({
      ...company,
      applications,
      contacts,
      rejectionCount,
      avgStageReached,
    });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post(
  "/",
  validate(createCompanySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const company = await Company.create({
        ...req.body,
        userId: user._id,
      });
      res.status(201).json(company);
    } catch (err) {
      next(err);
    }
  }
);

// PUT update
router.put(
  "/:id",
  validate(updateCompanySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const company = await Company.findOneAndUpdate(
        { _id: req.params.id, userId: user._id },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!company) throw new NotFoundError("Company");
      res.json(company);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const result = await Company.findOneAndDelete({
        _id: req.params.id,
        userId: user._id,
      });
      if (!result) throw new NotFoundError("Company");

      // Unlink applications and contacts from this company
      await Promise.all([
        Application.updateMany(
          { userId: user._id, companyId: result._id },
          { $unset: { companyId: "" } }
        ),
        Contact.updateMany(
          { userId: user._id, companyId: result._id },
          { $unset: { companyId: "" } }
        ),
      ]);

      res.json({ message: "Company deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
