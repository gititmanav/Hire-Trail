import { Router, Request, Response, NextFunction } from "express";
import { Company } from "../models/Company.js";
import { Application } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateCompanySchema } from "../validators/companies.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

/** Extract domain from a URL. */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// GET list: companies for current user with pagination + search + application counts
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 24));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const query: any = { users: user._id };
    if (search.trim()) {
      query.name = new RegExp(search.trim(), "i");
    }

    const [companies, total] = await Promise.all([
      Company.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Company.countDocuments(query),
    ]);

    // Get application counts per company for this user
    const companyIds = companies.map((c) => c._id);
    const appCounts = await Application.aggregate([
      { $match: { userId: user._id, companyId: { $in: companyIds } } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(appCounts.map((a) => [a._id.toString(), a.count]));

    const data = companies.map((c) => ({
      ...c,
      applicationCount: countMap.get(c._id.toString()) || 0,
    }));

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// GET one company with details
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const company = await Company.findOne({ _id: req.params.id, users: user._id }).lean();
    if (!company) throw new NotFoundError("Company");

    const [applications, appCount] = await Promise.all([
      Application.find({ userId: user._id, companyId: company._id }).lean(),
      Application.countDocuments({ userId: user._id, companyId: company._id }),
    ]);

    res.json({ ...company, applications, applicationCount: appCount });
  } catch (err) {
    next(err);
  }
});

// POST create / find-or-create company
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const { name, website } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const domain = website ? extractDomain(website) : "";
    const company = await Company.findOneAndUpdate(
      { name: name.trim() },
      {
        $setOnInsert: { name: name.trim(), website: website || "", domain, createdBy: user._id },
        $addToSet: { users: user._id },
      },
      { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
    );

    // Update website/domain if not already set
    if (!company.website && website) {
      company.website = website;
      company.domain = domain;
      await company.save();
    }

    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

// PUT update company
router.put("/:id", validate(updateCompanySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const company = await Company.findOne({ _id: req.params.id, users: user._id });
    if (!company) throw new NotFoundError("Company");

    if (req.body.website !== undefined) {
      company.website = req.body.website;
      company.domain = req.body.website ? extractDomain(req.body.website) : company.domain;
    }
    if (req.body.domain !== undefined) company.domain = req.body.domain;
    await company.save();
    res.json(company);
  } catch (err) {
    next(err);
  }
});

export default router;
