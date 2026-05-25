import { Router, Request, Response, NextFunction } from "express";
import { Contact, CONTACT_SOURCES } from "../models/Contact.js";
import { Company } from "../models/Company.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createContactSchema,
  updateContactSchema,
} from "../validators/contacts.js";
import { NotFoundError } from "../errors/AppError.js";
import { ensureCompanyLogo } from "./companies.js";

const router = Router();
router.use(ensureAuth);

/** Empty string → null, otherwise pass to `new Date()`. */
function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

/** Find-or-create a Company for this user, returning its _id as a string.
 *  Fires a background logo fetch so the next page load shows the brand mark. */
async function findOrCreateCompanyId(name: string, userId: any): Promise<string | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const company = await Company.findOneAndUpdate(
    { name: trimmed },
    {
      $setOnInsert: { name: trimmed, website: "", domain: "", createdBy: userId },
      $addToSet: { users: userId },
    },
    { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
  );
  if (company) void ensureCompanyLogo(company).catch(() => undefined);
  return company?._id?.toString() || null;
}

// GET list (paginated). Optional ?source=extension|manual|email filter.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const query: any = { userId: user._id };
    const companyIdParam = req.query.companyId as string;
    if (companyIdParam) query.companyId = companyIdParam;

    const sourceParam = req.query.source as string;
    if (sourceParam && (CONTACT_SOURCES as readonly string[]).includes(sourceParam)) {
      query.source = sourceParam;
    }

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ lastContactDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments(query),
    ]);

    res.json({
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: user._id,
    }).lean();
    if (!contact) throw new NotFoundError("Contact");
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

// POST create
router.post(
  "/",
  validate(createContactSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const body = req.body;

      // If no companyId was given but a company name was typed, find-or-create
      // the Company so the contact is properly linked. This keeps the Company
      // graph in sync regardless of whether the user picked from the dropdown
      // or typed a brand-new name.
      let companyId: string | null = body.companyId || null;
      if (!companyId && body.company) {
        companyId = await findOrCreateCompanyId(body.company, user._id);
      }

      const contact = await Contact.create({
        ...body,
        companyId,
        nextFollowUpDate: parseDate(body.nextFollowUpDate),
        userId: user._id,
      });
      res.status(201).json(contact);
    } catch (err) {
      next(err);
    }
  }
);

// PUT update
router.put(
  "/:id",
  validate(updateContactSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = { ...req.body };

      if ("lastContactDate" in data) data.lastContactDate = parseDate(data.lastContactDate);
      if ("lastOutreachDate" in data) data.lastOutreachDate = parseDate(data.lastOutreachDate);
      if ("nextFollowUpDate" in data) data.nextFollowUpDate = parseDate(data.nextFollowUpDate);

      // Mirror create behavior: if company name changed and no companyId provided,
      // find-or-create one.
      if (data.company && !data.companyId) {
        data.companyId = await findOrCreateCompanyId(data.company, user._id);
      }

      const contact = await Contact.findOneAndUpdate(
        { _id: req.params.id, userId: user._id },
        { $set: data },
        { new: true, runValidators: true }
      );
      if (!contact) throw new NotFoundError("Contact");
      res.json(contact);
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
      const result = await Contact.findOneAndDelete({
        _id: req.params.id,
        userId: user._id,
      });
      if (!result) throw new NotFoundError("Contact");
      res.json({ message: "Contact deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
