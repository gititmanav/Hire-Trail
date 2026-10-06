import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Contact, CONTACT_OUTREACH_STATUSES, CONTACT_SOURCES } from "../models/Contact.js";
import { Company } from "../models/Company.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createContactSchema,
  updateContactSchema,
} from "../validators/contacts.js";
import { AppError, NotFoundError } from "../errors/AppError.js";
import { ensureCompanyLogo } from "./companies.js";
import { searchRegex } from "../utils/regex.js";

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
  // Skip blanks and placeholders ("Unknown") so we never pollute the company
  // graph with a junk doc when the contact's employer wasn't captured.
  if (!trimmed || ["unknown", "unknown company", "n/a"].includes(trimmed.toLowerCase())) return null;
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

// GET list (paginated). Optional filters: ?source=extension|manual|email,
// ?status=<outreach status>, ?search=<name or company>. `statusCounts` counts
// each outreach status under the other filters (so the Status options can
// show them); a contact saved before outreach tracking counts as not_contacted.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    // Up to 1000: the CSV export and the company pages read every contact at once.
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const base: any = { userId: user._id };
    // Cast here: aggregate() (the status counts) doesn't cast strings like find() does.
    const companyIdParam = req.query.companyId as string;
    if (companyIdParam) {
      if (!mongoose.Types.ObjectId.isValid(companyIdParam)) throw new AppError("Invalid company id.", 400);
      base.companyId = new mongoose.Types.ObjectId(companyIdParam);
    }

    const sourceParam = req.query.source as string;
    if (sourceParam && (CONTACT_SOURCES as readonly string[]).includes(sourceParam)) {
      base.source = sourceParam;
    }

    const term = searchRegex(req.query.search);
    if (term) base.$or = [{ name: term }, { company: term }];

    const query: any = { ...base };
    const statusParam = req.query.status as string;
    if (statusParam && (CONTACT_OUTREACH_STATUSES as readonly string[]).includes(statusParam)) {
      query.outreachStatus = statusParam === "not_contacted" ? { $in: ["not_contacted", null] } : statusParam;
    }

    const [contacts, total, byStatus] = await Promise.all([
      Contact.find(query)
        .sort({ lastContactDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments(query),
      Contact.aggregate<{ _id: string; n: number }>([
        { $match: base },
        { $group: { _id: { $ifNull: ["$outreachStatus", "not_contacted"] }, n: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = Object.fromEntries(CONTACT_OUTREACH_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const row of byStatus) statusCounts[row._id] = (statusCounts[row._id] ?? 0) + row.n;

    res.json({
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      statusCounts,
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
