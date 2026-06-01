import { Router, Request, Response, NextFunction } from "express";
import { Application } from "../models/Application.js";
import { Company } from "../models/Company.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createApplicationSchema, updateApplicationSchema } from "../validators/applications.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";
import { ensureCompanyLogo } from "./companies.js";
import { enrichAndAnalyzeOnCreate } from "../services/ai/enrichOnCreate.js";
import { runAnalyzeWorker } from "../services/ai/autoAnalyze.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { User } from "../models/User.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { TailorSession } from "../models/TailorSession.js";

/** Thin summary of a TailorSession for inlining into Application list/get responses. */
export interface AppFitSummary {
  sessionId: string;
  status: "processing" | "succeeded" | "failed" | "deferred";
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "D" | "F" | "";
  summary: string;
  matchedCount: number;
  missingCount: number;
  /** First few matched skills — surfaced by the Application row AI panel as
   *  a checkmark list. Capped server-side so the response stays small. */
  topMatched: string[];
  errorMessage?: string;
}

/** Resolve `fit` summaries for a list of applications in one bulk Mongo query.
 *  Returns a map keyed by application id (string). Apps with no tailorSessionId
 *  or a missing session are simply absent from the map (frontend renders the
 *  "no fit yet" state). */
async function loadFitSummaries(apps: Array<{ _id: unknown; tailorSessionId: unknown }>): Promise<Map<string, AppFitSummary>> {
  const sessionIds = apps.map((a) => a.tailorSessionId).filter(Boolean);
  if (sessionIds.length === 0) return new Map();
  const sessions = await TailorSession.find({ _id: { $in: sessionIds } })
    .select("_id status fitScore fitGrade summary matchedSkills missingSkills errorMessage")
    .lean();
  const byId = new Map(sessions.map((s) => [String(s._id), s]));
  const out = new Map<string, AppFitSummary>();
  for (const a of apps) {
    if (!a.tailorSessionId) continue;
    const s = byId.get(String(a.tailorSessionId));
    if (!s) continue;
    out.set(String(a._id), {
      sessionId: String(s._id),
      status: s.status,
      fitScore: s.fitScore || 0,
      fitGrade: s.fitGrade || "",
      summary: s.summary || "",
      matchedCount: Array.isArray(s.matchedSkills) ? s.matchedSkills.length : 0,
      missingCount: Array.isArray(s.missingSkills) ? s.missingSkills.length : 0,
      topMatched: Array.isArray(s.matchedSkills) ? s.matchedSkills.slice(0, 3) : [],
      errorMessage: s.errorMessage || undefined,
    });
  }
  return out;
}

import { extractDomainFromUrl, isJobBoardDomain } from "../utils/companyDomain.js";

/** Local alias kept so existing call sites read naturally. */
const extractDomain = extractDomainFromUrl;

/** Domain to STORE on a Company doc derived from an Application's jobUrl.
 *  Returns "" for known job-board hosts (Workday, Greenhouse, etc.) so the
 *  logo fetcher falls back to a name-derived domain instead of pulling the
 *  ATS's logo. See utils/companyDomain.ts for context. */
function companyDomainFromJobUrl(jobUrl?: string | null): string {
  if (!jobUrl) return "";
  const d = extractDomain(jobUrl);
  if (!d || isJobBoardDomain(d)) return "";
  return d;
}

/** Website to STORE on a Company doc derived from an Application's jobUrl.
 *  Mirrors `companyDomainFromJobUrl` — empty for job boards because storing
 *  e.g. "https://workday.com" as a company's website is just misleading. */
function companyWebsiteFromJobUrl(jobUrl?: string | null): string {
  if (!jobUrl) return "";
  try {
    const u = new URL(jobUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (isJobBoardDomain(host)) return "";
    return u.origin;
  } catch {
    return "";
  }
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

    const fitMap = await loadFitSummaries(apps);
    const enriched = apps.map((a) => ({ ...a, fit: fitMap.get(String(a._id)) || null }));

    res.json({ data: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.id, userId: user._id }).lean();
    if (!app) throw new NotFoundError("Application");
    const fitMap = await loadFitSummaries([app]);
    res.json({ ...app, fit: fitMap.get(String(app._id)) || null });
  } catch (err) { next(err); }
});

// POST create (with shared-company linking)
router.post("/", validate(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    // Find-or-create shared company
    let companyId = req.body.companyId || null;
    let createdOrFoundCompany: typeof Company.prototype | null = null;
    if (!companyId && req.body.company) {
      const domain = companyDomainFromJobUrl(req.body.jobUrl);
      const website = companyWebsiteFromJobUrl(req.body.jobUrl);
      const company = await Company.findOneAndUpdate(
        { name: req.body.company.trim() },
        {
          $setOnInsert: { name: req.body.company.trim(), website, domain, createdBy: user._id },
          $addToSet: { users: user._id },
        },
        { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
      );
      companyId = company._id;
      createdOrFoundCompany = company;
    }
    // Duplicate detection: if jobUrl is non-empty, check for existing
    if (req.body.jobUrl) {
      const existing = await Application.findOne({ userId: user._id, jobUrl: req.body.jobUrl });
      if (existing) {
        return res.status(409).json({ error: "Already tracked", applicationId: existing._id });
      }
    }
    // The demo user is skipped entirely by the AI pipeline (seeded fake
    // sessions instead) so we don't burn real LLM quota on the ~650 demo apps.
    const isDemoUser = (await User.findById(user._id).select("email").lean())?.email === "demo@hiretrail.com";

    // Seed the extraction status synchronously when the AI pass will run, so the
    // create response already carries "processing" — the client shows the
    // "Reading this posting…" indicator and starts polling immediately, instead
    // of waiting for the next focus refetch to notice the background job.
    const jdLen = (req.body.jobDescription || "").trim().length;
    const willExtract = !isDemoUser && req.body.source !== "email" && jdLen >= 200;
    const app = await Application.create({
      ...req.body,
      userId: user._id,
      companyId,
      resumeId: req.body.resumeId || null,
      aiExtractionStatus: willExtract ? "processing" : "idle",
    });
    res.status(201).json(app);

    // Background logo fetch — same pattern as contacts.
    if (createdOrFoundCompany) {
      void ensureCompanyLogo(createdOrFoundCompany).catch(() => undefined);
    }

    // Background AI pipeline (fire-and-forget): URL-slug company seed → AI field
    // extraction + JD cleaning → fit auto-analysis on the cleaned JD.
    void enrichAndAnalyzeOnCreate(app._id, { isDemoUser });
  } catch (err) { next(err); }
});

/** Manually (re)run the AI fit analysis for one application. Backs the
 *  "Run AI analysis" / "Retry" / "Run now" CTAs on the application row. Creates
 *  a fresh processing TailorSession, links it to the app, and runs the worker —
 *  bypassing the daily auto-analyze cap because the user explicitly asked. */
router.post("/:id/reanalyze", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.id, userId: user._id });
    if (!app) throw new NotFoundError("Application");

    const jd = (app.jobDescription || "").trim();
    if (jd.length < 50) throw new ValidationError("Add a job description before running AI analysis.");

    const hasProfile = await MasterProfile.exists({ userId: user._id });
    if (!hasProfile) throw new ValidationError("Set up your master profile first to enable AI analysis.");

    const session = await TailorSession.create({
      userId: user._id,
      applicationId: app._id,
      jobTitle: app.role || "",
      company: app.company || "",
      jobUrl: app.jobUrl || "",
      jobDescription: jd.slice(0, 30_000),
      status: "processing",
      fitScore: 0,
      fitGrade: "",
      provider: "",
      modelId: "",
    });
    await Application.updateOne({ _id: app._id }, { $set: { tailorSessionId: session._id } });

    res.status(202).json({ sessionId: session._id.toString(), status: "processing" });

    runAnalyzeWorker(session._id, user._id, {
      applicationId: app._id,
      jobTitle: app.role || "",
      company: app.company || "",
      url: app.jobUrl || "",
      jobDescription: jd,
    });
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
      // Re-link shared company if name changed. Same job-board guard as create
      // — we never want a Workday/Greenhouse host stored as the canonical
      // Company.domain. See utils/companyDomain.ts.
      const domain = companyDomainFromJobUrl(data.jobUrl ?? existing.jobUrl);
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
    if (data.applicationDate !== undefined) {
      // Accept YYYY-MM-DD (treated as local midnight) or ISO datetime.
      const d = /^\d{4}-\d{2}-\d{2}$/.test(data.applicationDate)
        ? new Date(`${data.applicationDate}T00:00:00`)
        : new Date(data.applicationDate);
      if (!isNaN(d.getTime())) existing.applicationDate = d;
    }
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
