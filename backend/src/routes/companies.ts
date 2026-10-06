import { Router, Request, Response, NextFunction } from "express";
import { Company, ICompany } from "../models/Company.js";
import { Application, STAGES } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateCompanySchema } from "../validators/companies.js";
import { NotFoundError } from "../errors/AppError.js";
import { searchRegex } from "../utils/regex.js";
import { env } from "../config/env.js";
import {
  extractDomainFromUrl,
  isJobBoardDomain,
  resolveLogoDomain,
  shouldInvalidateCachedLogo,
} from "../utils/companyDomain.js";

const router = Router();
router.use(ensureAuth);

/** Refresh logos no more than once every 30 days even if they 404'd previously. */
const LOGO_RETRY_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Local alias preserved so legacy call sites below read naturally. */
const extractDomain = extractDomainFromUrl;

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
  // Legacy invalidation: a prior version of the create flow stored the
  // applicant's jobUrl host as Company.domain. For job-board hosts (Workday,
  // Greenhouse, etc.) Google's S2 favicons then returned the ATS's logo, not
  // the company's. Detect that signature and refetch instead of returning
  // early on the bad cached value. Also clears the 30-day retry suppressor.
  if (company.logoUrl && shouldInvalidateCachedLogo({ domain: company.domain })) {
    company.logoUrl = "";
    company.logoPublicId = "";
    company.logoFetchedAt = null;
    company.domain = "";
  }
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

  // Name-first resolver: prefer "Google" → "google.com" over whatever URL
  // host happens to be stored. See utils/companyDomain.ts for the priority
  // and the job-board exclusion list.
  const domain = resolveLogoDomain({
    name: company.name,
    website: company.website,
    domain: company.domain,
  });
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

// GET list: the person's companies, paginated. ?search= (name), ?stage= (an
// application of theirs there is at that stage), ?sort=name|applications|recent
// (A–Z, most applications, latest application). Each row carries its
// applicationCount; `stageCounts` feeds the Stage filter's options.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 24));
    const skip = (page - 1) * limit;
    const sort = (["name", "applications", "recent"] as const).find((v) => v === req.query.sort) ?? "name";
    const stage = (STAGES as readonly string[]).includes(req.query.stage as string) ? (req.query.stage as string) : "";

    const query: any = { users: user._id };
    const nameRegex = searchRegex(req.query.search);
    if (nameRegex) query.name = nameRegex;

    // This person's applications per company: how many, the latest, which stages.
    const rows = await Application.aggregate<{ _id: unknown; count: number; latest: Date | null; stages: string[] }>([
      { $match: { userId: user._id, companyId: { $ne: null } } },
      { $group: { _id: "$companyId", count: { $sum: 1 }, latest: { $max: "$applicationDate" }, stages: { $addToSet: "$stage" } } },
    ]);
    const byId = new Map(rows.map((r) => [String(r._id), r]));

    // Companies with an application at each stage, under the search (the Stage options' counts).
    const searched = nameRegex ? new Set((await Company.find(query, { _id: 1 }).lean()).map((c) => String(c._id))) : null;
    const stageCounts = Object.fromEntries(STAGES.map((st) => [
      st, rows.filter((r) => r.stages.includes(st) && (!searched || searched.has(String(r._id)))).length,
    ]));

    if (stage) query._id = { $in: rows.filter((r) => r.stages.includes(stage)).map((r) => r._id) };

    let companies: any[];
    let total: number;
    if (sort === "name") {
      [companies, total] = await Promise.all([
        Company.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Company.countDocuments(query),
      ]);
    } else {
      // Sorting by this person's own activity: their company list is small, so sort it here.
      const all = await Company.find(query).lean();
      const key = (c: any) => {
        const r = byId.get(String(c._id));
        return sort === "applications" ? r?.count ?? 0 : r?.latest ? new Date(r.latest).getTime() : 0;
      };
      all.sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name));
      total = all.length;
      companies = all.slice(skip, skip + limit);
    }

    const data = companies.map((c) => ({ ...c, applicationCount: byId.get(String(c._id))?.count ?? 0 }));
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, stageCounts });
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

    // Job-board URLs (Workday, Greenhouse, etc.) are NOT the company's domain.
    // Storing them blew up the logo fetcher — see utils/companyDomain.ts.
    const rawDomain = website ? extractDomain(website) : "";
    const domain = rawDomain && !isJobBoardDomain(rawDomain) ? rawDomain : "";
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
      const raw = req.body.website ? extractDomain(req.body.website) : "";
      // Reject job-board hosts so we don't re-introduce the wrong-logo bug
      // when a user pastes a Workday/Greenhouse URL into the website field.
      company.domain = raw && !isJobBoardDomain(raw) ? raw : "";
    }
    if (req.body.domain !== undefined) {
      company.domain = isJobBoardDomain(req.body.domain) ? "" : req.body.domain;
    }
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
