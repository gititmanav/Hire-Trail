import { Router, Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { Application, APPLICATION_SOURCES, STAGES } from "../models/Application.js";
import { searchRegex } from "../utils/regex.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  archiveApplicationSchema,
  batchApplicationsSchema,
  createApplicationSchema,
  importApplicationsSchema,
  updateApplicationSchema,
} from "../validators/applications.js";
import { NotFoundError, ValidationError } from "../errors/AppError.js";
import {
  archivedFields,
  createApplication,
  deleteApplications,
  DuplicateApplicationError,
  importApplications,
  UNARCHIVED_FIELDS,
  updateApplication,
} from "../services/applications/write.js";
import { batchApplications } from "../services/applications/batch.js";
import { loadInsights, loadSweep } from "../services/applications/insights.js";
import { SUMMARY_STAGES, withFit } from "../services/applications/summary.js";
import { startFitCheckForApplication } from "../services/ai/features/fitCheck.js";
import { reviveAiJobs } from "../services/ai/jobs.js";
import type { AiUser } from "../services/ai/gateway.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { User } from "../models/User.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { Resume } from "../models/Resume.js";

const router = Router();
router.use(ensureAuth);

const LIST_SORTS = ["company", "role", "stage", "applicationDate", "createdAt"] as const;

/** Tab filter. `$in: [false, null]` also matches legacy documents that predate
 *  the `archived` field (null matches missing) while staying a plain index
 *  lookup — the old `$or` on `$exists` could not use the compound index. */
function archivedMatch(param: unknown): Record<string, unknown> {
  if (param === "true") return { archived: true };
  if (param === "all") return {};
  return { archived: { $in: [false, null] } };
}

/** Filters shared by the list, board, and filter-options endpoints. Every
 *  value is validated — a stale or hand-edited URL narrows nothing instead of
 *  erroring (or reaching the database as an operator). */
export function listFilters(req: Request, userId: Types.ObjectId): Record<string, unknown> {
  const match: Record<string, unknown> = { userId, ...archivedMatch(req.query.archived) };
  const search = searchRegex(req.query.search);
  if (search) match.$or = [{ company: search }, { role: search }];
  const company = typeof req.query.company === "string" ? req.query.company.trim() : "";
  if (company) match.company = company;
  const resume = req.query.resumeId;
  if (resume === "none") match.resumeId = null;
  else if (typeof resume === "string" && Types.ObjectId.isValid(resume)) match.resumeId = new Types.ObjectId(resume);
  const source = req.query.source;
  if (typeof source === "string" && (APPLICATION_SOURCES as readonly string[]).includes(source)) {
    // Legacy docs predate `source`; the schema default ("manual") never ran for them.
    match.source = source === "manual" ? { $in: ["manual", null] } : source;
  }
  return match;
}

/**
 * GET list: filters, sort, pagination — one aggregate round-trip returning the
 * page, the filtered total, and per-stage counts (computed over the stage-less
 * match so filter chips show true totals, not just the loaded page).
 *
 * `fields=summary` omits `jobDescription` (the bulk of every document) and adds
 * a `hasJobDescription` flag — lists and the board never render the JD.
 * `tabCounts` gives Active/Archived totals so clients don't need a second call.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 25));
    const sortField = (LIST_SORTS as readonly string[]).includes(req.query.sort as string)
      ? (req.query.sort as string)
      : "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    // _id tiebreak: identical createdAt/company values otherwise shuffle
    // between pages, duplicating or skipping rows.
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder, _id: sortOrder };

    const base = listFilters(req, user._id as Types.ObjectId);
    const stage = typeof req.query.stage === "string" && (STAGES as readonly string[]).includes(req.query.stage)
      ? req.query.stage
      : null;
    const pageMatch = stage ? { stage } : {};
    const summary = req.query.fields === "summary";

    const [[facet], tabAgg] = await Promise.all([
      Application.aggregate<{
        data: Array<Record<string, unknown> & { _id: unknown; tailorSessionId: unknown }>;
        total: { n: number }[];
        stageCounts: { _id: string; n: number }[];
      }>([
        { $match: base },
        // Sorted before the facet: a sub-pipeline can't use an index, so a
        // $sort inside it sorted every full document in memory. Out here the
        // match + sort run as one indexed query; the facets keep the order.
        { $sort: sort },
        {
          $facet: {
            stageCounts: [{ $group: { _id: "$stage", n: { $sum: 1 } } }],
            total: [{ $match: pageMatch }, { $count: "n" }],
            data: [
              { $match: pageMatch },
              { $skip: (page - 1) * limit },
              { $limit: limit },
              ...(summary ? SUMMARY_STAGES : []),
            ],
          },
        },
      ]),
      Application.aggregate<{ _id: boolean; n: number }>([
        { $match: { userId: user._id } },
        { $group: { _id: { $eq: ["$archived", true] }, n: { $sum: 1 } } },
      ]),
    ]);

    const total = facet?.total[0]?.n ?? 0;
    const stageCounts: Record<string, number> = {};
    for (const { _id, n } of facet?.stageCounts ?? []) stageCounts[_id] = n;
    const tabCounts = {
      active: tabAgg.find((t) => t._id === false)?.n ?? 0,
      archived: tabAgg.find((t) => t._id === true)?.n ?? 0,
    };

    const enriched = await withFit(facet?.data ?? [], { withSummary: !summary });
    // The list is what polls while AI work is in flight — pick up stalled jobs.
    if (enriched.some((a) => (a as { aiExtractionStatus?: string }).aiExtractionStatus === "processing" || a.fit?.status === "processing")) {
      await reviveAiJobs(user._id as Types.ObjectId);
    }

    res.json({
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stageCounts,
      tabCounts,
    });
  } catch (err) { next(err); }
});

/** Distinct values the Filters menu offers (companies, sources, resumes in
 *  use) for the given tab — computed across ALL the user's applications, not
 *  the loaded page, so narrowing one filter never hides another's options. */
router.get("/filter-options", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const [agg] = await Application.aggregate<{ companies: string[]; sources: (string | null)[]; resumeIds: (Types.ObjectId | null)[] }>([
      { $match: { userId: user._id, ...archivedMatch(req.query.archived) } },
      { $group: { _id: null, companies: { $addToSet: "$company" }, sources: { $addToSet: "$source" }, resumeIds: { $addToSet: "$resumeId" } } },
    ]);
    res.json({
      companies: (agg?.companies ?? []).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      sources: [...new Set((agg?.sources ?? []).map((s) => s ?? "manual"))].sort(),
      resumeIds: (agg?.resumeIds ?? []).filter(Boolean).map(String),
      hasUnassignedResume: (agg?.resumeIds ?? []).some((r) => r == null),
    });
  } catch (err) { next(err); }
});

/** The reply window, and how many applications the sweep would offer →
 *  { replyWindow: { days, sample, isDefault, lateReplies }, sweepCount }
 *  (services/applications/insights.ts). */
router.get("/insights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json(await loadInsights(user._id as Types.ObjectId));
  } catch (err) { next(err); }
});

/** Open applications gone quiet past twice the reply window, longest idle
 *  first (at most 300), in the list's `fields=summary` shape →
 *  { data, replyWindow }. */
router.get("/sweep", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json(await loadSweep(user._id as Types.ObjectId));
  } catch (err) { next(err); }
});

/** One action over many applications: archive · unarchive · delete · stage ·
 *  undoStage. Registered before the `/:id` routes. → { matched, modified } */
router.post("/batch", validate(batchApplicationsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json(await batchApplications(user._id as Types.ObjectId, req.body));
  } catch (err) { next(err); }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const found = await Application.findOne({ _id: req.params.id, userId: user._id }).lean();
    if (!found) throw new NotFoundError("Application");
    const [app] = await withFit([found]);
    if (app.aiExtractionStatus === "processing" || app.fit?.status === "processing") await reviveAiJobs(user._id as Types.ObjectId);
    res.json(app);
  } catch (err) { next(err); }
});

// POST create (with shared-company linking) — the shared write path.
router.post("/", validate(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await createApplication(user._id as Types.ObjectId, req.body);
    res.status(201).json(app);
  } catch (err) {
    // The extension reads `applicationId` off this exact body.
    if (err instanceof DuplicateApplicationError) {
      res.status(409).json({ error: "Already tracked", applicationId: err.applicationId });
      return;
    }
    next(err);
  }
});

/** Manually (re)run the fit check for one application. Backs the "Run fit
 *  check" / "Retry" / "Run now" CTAs. Creates a fresh session linked to the
 *  app — bypassing the daily automatic cap because the person asked. */
router.post("/:id/reanalyze", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.id, userId: user._id });
    if (!app) throw new NotFoundError("Application");
    const owner = (await User.findById(user._id).select("email aiOverride").lean()) as AiUser | null;
    const session = await startFitCheckForApplication(app, { trigger: "manual", user: owner ?? (user as unknown as AiUser) });
    if (!session) throw new ValidationError("A fit check can't run for this application yet.");
    res.status(202).json({ sessionId: session._id.toString(), status: session.status });
  } catch (err) { next(err); }
});

/** Ensure a per-application TAILORED VARIANT resume exists and return its id.
 *  Each application tailors its OWN resume document so tailoring one role never
 *  clobbers another (or the master/primary). Lineage: baseResumeId = the user's
 *  current primary; tailorSessionId = the app's analysis. Idempotent — reuses the
 *  app's existing tailored variant. The variant's editable document is derived
 *  lazily from the master profile on first GET /resumes/:id/document. */
router.post("/:id/tailor-resume", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.id, userId: user._id });
    if (!app) throw new NotFoundError("Application");

    if (app.resumeId) {
      const existing = await Resume.findOne({ _id: app.resumeId, userId: user._id });
      if (existing && (existing.tags || []).includes("tailored")) {
        res.json({ resumeId: existing._id.toString() });
        return;
      }
    }

    const hasProfile = await MasterProfile.exists({ userId: user._id });
    if (!hasProfile) throw new ValidationError("Set up your master profile first to tailor a resume.");

    const dbUser = await User.findById(user._id).select("primaryResumeId");
    const baseResumeId = (dbUser?.primaryResumeId as typeof app.resumeId) ?? null;
    const name = `Tailored — ${app.company || "Role"}${app.role ? ` / ${app.role}` : ""}`.slice(0, 200);

    const variant = await Resume.create({
      userId: user._id,
      name,
      targetRole: app.role || "",
      tags: ["tailored"],
      fileName: "",
      baseResumeId,
      tailorSessionId: app.tailorSessionId ?? null,
    });
    await Application.updateOne({ _id: app._id }, { $set: { resumeId: variant._id } });
    res.json({ resumeId: variant._id.toString() });
  } catch (err) { next(err); }
});

/** CSV import (up to 500 rows). Bad rows and already-tracked job URLs are
 *  skipped and counted; only a file with nothing usable is an error. */
router.post("/bulk", validate(importApplicationsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const result = await importApplications(user._id as Types.ObjectId, req.body.applications);
    if (!result.count && !result.duplicates) throw new ValidationError(`Nothing could be imported — ${result.errors[0]}`);
    const skipped = [
      result.duplicates && `${result.duplicates} already tracked`,
      result.errors.length && `${result.errors.length} skipped`,
    ].filter(Boolean);
    const message = `Imported ${result.count} application${result.count === 1 ? "" : "s"}${skipped.length ? ` · ${skipped.join(" · ")}` : ""}`;
    res.status(result.count ? 201 : 200).json({ message, ...result });
  } catch (err) { next(err); }
});

// PUT update — the shared write path.
router.put("/:id", validate(updateApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json(await updateApplication(user._id as Types.ObjectId, String(req.params.id), req.body));
  } catch (err) { next(err); }
});

// PUT archive — { reason?: "manual" | "rejected" | "auto_stale" | "ghosted" }
router.put("/:id/archive", validate(archiveApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: archivedFields(req.body.reason) },
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
      { $set: UNARCHIVED_FIELDS },
      { new: true }
    );
    if (!app) throw new NotFoundError("Application");
    res.json(app);
  } catch (err) { next(err); }
});

// DELETE — with its deadlines, contact links and fit checks (never resumes).
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Application");
    const deleted = await deleteApplications(user._id as Types.ObjectId, [new Types.ObjectId(id)]);
    if (!deleted) throw new NotFoundError("Application");
    res.json({ message: "Application deleted" });
  } catch (err) { next(err); }
});

export default router;
