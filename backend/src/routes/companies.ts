import { Router, Request, Response, NextFunction } from "express";
import { Company, ICompany } from "../models/Company.js";
import { Application } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateCompanySchema } from "../validators/companies.js";
import { NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const router = Router();
router.use(ensureAuth);

/** Refresh logos no more than once every 30 days even if they 404'd previously. */
const LOGO_RETRY_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Extract domain from a URL. */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Best-effort domain from a company name. Drops common suffixes, lowercases,
 *  strips non-alphanum. "Acme Corp" → "acme.com". Wrong for many companies
 *  (Anthropic ≠ anthropic.com? actually right), but right often enough for the
 *  90% case — Clearbit returns 404 otherwise and we silently fall back. */
function deriveDomainFromName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|gmbh|co|company)\.?\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "";
  return `${cleaned}.com`;
}

const cloudinaryEnabled = () => !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

async function uploadBufferToCloudinary(buffer: Buffer, publicId: string): Promise<{ url: string; publicId: string }> {
  const { cloudinary } = await import("../config/cloudinary.js");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "hiretrail/company-logos",
        resource_type: "image",
        access_mode: "public",
        public_id: publicId,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Idempotently fetch + cache a Company's logo. Returns the document with
 * `logoUrl` populated (possibly empty if we tried and failed).
 *
 *  - If `logoUrl` is already set, no-op.
 *  - Else if we tried recently (< 30d), no-op.
 *  - Else pick a domain (website > derived from name), fetch
 *    `https://logo.clearbit.com/{domain}`, upload to Cloudinary, persist.
 *  - On 404 or upload failure, stamp `logoFetchedAt` to suppress retries.
 *
 * Designed for fire-and-forget usage from the create flow; also exposed via
 * the POST /:id/logo endpoint for explicit refresh.
 */
/** Best-effort save: never throws, so logo-fetch failures can't bubble up as
 *  Mongoose validation errors on otherwise-fine legacy docs. */
async function safeSaveCompany(company: ICompany): Promise<void> {
  try { await company.save(); }
  catch (err) { console.warn(`[ensureCompanyLogo] save failed for ${company._id}:`, err instanceof Error ? err.message : err); }
}

export async function ensureCompanyLogo(company: ICompany): Promise<ICompany> {
  if (company.logoUrl) return company;
  if (company.logoFetchedAt && Date.now() - company.logoFetchedAt.getTime() < LOGO_RETRY_INTERVAL_MS) {
    return company;
  }
  // Stamp first — if anything below fails, we still mark "tried" so we don't
  // spin our wheels on the next request.
  company.logoFetchedAt = new Date();

  if (!cloudinaryEnabled()) {
    await safeSaveCompany(company);
    return company;
  }

  const domain = (company.domain || extractDomain(company.website) || deriveDomainFromName(company.name)).trim();
  if (!domain) {
    await safeSaveCompany(company);
    return company;
  }

  // Only Google S2 favicons. Clearbit's free endpoint has been intermittent
  // since the HubSpot acquisition (intermittent DNS, frequent 404s), and the
  // browser-side fallback to it floods consoles with ERR_NAME_NOT_RESOLVED.
  // Google's service is always reachable, returns a sane PNG, and doesn't
  // require an API key.
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      // <300 bytes is Google's default "world globe" fallback — skip.
      if (buf.byteLength >= 300) {
        const publicId = `${company._id.toString()}-${Date.now()}`;
        const { url: cdnUrl, publicId: cloudId } = await uploadBufferToCloudinary(buf, publicId);
        company.logoUrl = cdnUrl;
        company.logoPublicId = cloudId;
        if (!company.domain) company.domain = domain;
      }
    }
  } catch (err) {
    console.warn(`[ensureCompanyLogo:google] ${domain}:`, err instanceof Error ? err.message : err);
  }

  await safeSaveCompany(company);
  return company;
}

// GET list: companies for current user with pagination + search + application counts
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 24));
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

    // Fire-and-forget logo fetch. Don't block the user; they get a logo on
    // the next page load. Errors are swallowed inside ensureCompanyLogo.
    void ensureCompanyLogo(company).catch(() => undefined);

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

// POST /:id/logo — explicit logo refresh (also used as the "fetch on demand" path
// when the frontend renders a row that has no cached logo yet).
//
// This is a best-effort, opportunistic endpoint. It NEVER errors out — if the
// company isn't found, the id is malformed, the fetch fails, or anything else
// goes sideways, we return 200 with `{ logoUrl: "" }`. That way the frontend
// can keep showing the monogram fallback without spamming the console.
router.post("/:id/logo", async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const user = getUser(req);
    const idParam = typeof req.params.id === "string" ? req.params.id : "";
    // Guard cast errors before findOne even runs.
    if (!/^[a-f0-9]{24}$/i.test(idParam)) {
      res.json({ logoUrl: "", logoFetchedAt: null });
      return;
    }
    const company = await Company.findOne({ _id: idParam, users: user._id });
    if (!company) {
      res.json({ logoUrl: "", logoFetchedAt: null });
      return;
    }
    const updated = await ensureCompanyLogo(company);
    res.json({ logoUrl: updated.logoUrl, logoFetchedAt: updated.logoFetchedAt });
  } catch (err) {
    console.warn("[POST /companies/:id/logo]", err instanceof Error ? err.message : err);
    res.json({ logoUrl: "", logoFetchedAt: new Date() });
  }
});

export default router;
