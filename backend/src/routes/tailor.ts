/**
 * Tailor — JD analysis + per-application tailored variants.
 *
 *   POST   /api/tailor/analyze                — runs JD analysis, persists a new session
 *   POST   /api/tailor/init                   — extension "Tailor" entrypoint: creates a
 *                                                Drafting Application + linked session
 *   GET    /api/tailor/sessions/:id           — fetch a session
 *   GET    /api/tailor/sessions               — list user's sessions (most recent first)
 *   PATCH  /api/tailor/sessions/:id/suggestions/:sIdx
 *                                              — set decision: "accepted" | "rejected"
 *   PUT    /api/tailor/sessions/:id/mark-applied
 *                                              — transition linked Drafting app → Applied
 *                                                with the user's chosen resume
 *   POST   /api/tailor/sessions/:id/link/:applicationId
 *                                              — attach a session to an existing tracked application
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { TailorSession, type ITailorSession } from "../models/TailorSession.js";
import { Application } from "../models/Application.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { runAnalyzeWorker } from "../services/ai/autoAnalyze.js";
import { buildResumeDocument } from "../services/resume/document.js";
import { computeScore } from "../services/resume/score.js";
import { buildSuggestionChips } from "../services/resume/suggestions.js";
import { keywordCoverage, extractDocText } from "../services/resume/keywords.js";
import type { IMasterProfile } from "../models/MasterProfile.js";
import { NotFoundError } from "../errors/AppError.js";

/** Build the editor payload attached to a succeeded analysis: a ResumeDocument
 *  (master + accepted suggestions), the deterministic match score + chips, and
 *  the keyword-gap (matched/missing keywords + coverage count) computed against
 *  the document. */
function buildTailorEditorPayload(session: ITailorSession, master: IMasterProfile) {
  const jdKeywords = session.jdKeywords?.length
    ? [...session.jdKeywords]
    : [...session.matchedSkills, ...session.missingSkills];
  const doc = buildResumeDocument(master, { suggestions: session.suggestions, jdKeywords });
  const keywordGap = keywordCoverage(jdKeywords, extractDocText(doc));
  const score = computeScore(doc, jdKeywords);
  const suggestions = buildSuggestionChips(doc, keywordGap);
  return { document: { ...doc, score, suggestions }, keywordGap, score };
}

const router = Router();
router.use(ensureAuth);

const analyzeSchema = z.object({
  jobDescription: z.string().min(50, "Job description seems too short."),
  jobTitle: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  applicationId: z.string().optional(),
});

/** Stale-processing guard: if a session has been "processing" longer than this, we treat it as
 *  failed on the next read. This protects against the Vercel-kills-the-function case where the
 *  analyzer never got to write back its result. */
const PROCESSING_TIMEOUT_MS = 90_000;

router.post("/analyze", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const applicationId =
      parsed.data.applicationId && mongoose.isValidObjectId(parsed.data.applicationId)
        ? new mongoose.Types.ObjectId(parsed.data.applicationId)
        : null;

    const session = await TailorSession.create({
      userId: user._id,
      applicationId,
      jobTitle: parsed.data.jobTitle,
      company: parsed.data.company,
      jobUrl: parsed.data.url,
      jobDescription: parsed.data.jobDescription.slice(0, 30_000),
      status: "processing",
      fitScore: 0,
      fitGrade: "",
      provider: "",
      modelId: "",
    });

    res.status(202).json(session);

    runAnalyzeWorker(session._id, user._id, {
      jobTitle: parsed.data.jobTitle,
      company: parsed.data.company,
      url: parsed.data.url,
      jobDescription: parsed.data.jobDescription,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------- /init: extension "Tailor" button entrypoint -------------------- */

const initSchema = z.object({
  jobDescription: z.string().min(50, "Job description seems too short."),
  jobTitle: z.string().optional().default(""),
  company: z.string().optional().default(""),
  role: z.string().optional().default(""),
  url: z.string().optional().default(""),
});

/** Creates the Drafting Application + processing TailorSession atomically (well,
 *  back-to-back — there's no transaction since Atlas free tier doesn't support them,
 *  but the second create runs immediately and the orphan window is negligible).
 *  The extension calls this when the user clicks "Tailor" on a JD. */
router.post("/init", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = initSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const companyName = (parsed.data.company || "Unknown").trim() || "Unknown";
    const roleName = (parsed.data.role || parsed.data.jobTitle || "Untitled role").trim() || "Untitled role";

    // 1. Create the Drafting application. companyId stays null — the user can resolve
    //    or re-link it later; we don't want extension calls to fan out into Company
    //    upserts (that path lives in POST /applications).
    const application = await Application.create({
      userId: user._id,
      company: companyName,
      role: roleName,
      jobUrl: parsed.data.url,
      jobDescription: parsed.data.jobDescription.slice(0, 50_000),
      stage: "Drafting",
      applicationDate: new Date(),
    });

    // 2. Create the linked session in `processing`.
    const session = await TailorSession.create({
      userId: user._id,
      applicationId: application._id,
      jobTitle: parsed.data.jobTitle || roleName,
      company: companyName,
      jobUrl: parsed.data.url,
      jobDescription: parsed.data.jobDescription.slice(0, 30_000),
      status: "processing",
      fitScore: 0,
      fitGrade: "",
      provider: "",
      modelId: "",
    });

    // 3. Backfill the link the other way on the application.
    application.tailorSessionId = session._id;
    await application.save();

    // 4. Return both ids — the extension navigates to /tailor?session=<sessionId>.
    res.status(202).json({ session, application });

    // 5. Fire the LLM in the background.
    runAnalyzeWorker(session._id, user._id, {
      jobTitle: parsed.data.jobTitle,
      company: parsed.data.company,
      url: parsed.data.url,
      jobDescription: parsed.data.jobDescription,
    });
  } catch (err) {
    next(err);
  }
});

/** Mark long-stuck `processing` sessions as `failed` so the frontend can stop polling. */
async function reapStaleProcessing(session: ITailorSession): Promise<ITailorSession> {
  if (session.status !== "processing") return session;
  const age = Date.now() - new Date(session.updatedAt).getTime();
  if (age < PROCESSING_TIMEOUT_MS) return session;
  session.status = "failed";
  session.errorMessage = "Took too long — please retry.";
  await session.save();
  return session;
}

/** Find an in-flight Drafting session for a given job URL — used by the extension's
 *  Apply-click auto-detect to ask "did you use the tailored resume?" instead of
 *  silently creating a duplicate application. */
router.get("/sessions/find-draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const url = String(req.query.url || "").trim();
    if (!url) { res.json({ session: null }); return; }
    // We don't index by jobUrl on TailorSession; search by the linked Application's jobUrl.
    const apps = await Application.find({ userId: user._id, jobUrl: url, stage: "Drafting" }).sort({ updatedAt: -1 }).limit(5);
    for (const app of apps) {
      if (!app.tailorSessionId) continue;
      const session = await TailorSession.findOne({ _id: app.tailorSessionId, userId: user._id }).lean();
      if (session) { res.json({ session, application: app.toObject() }); return; }
    }
    res.json({ session: null });
  } catch (err) { next(err); }
});

router.get("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const rawLimit = req.query.limit;
    const limit = Math.min(50, parseInt(typeof rawLimit === "string" ? rawLimit : "20", 10));
    const applicationId = typeof req.query.applicationId === "string" ? req.query.applicationId : "";

    const filter: Record<string, unknown> = { userId: user._id };
    // Filter to a single application's tailor history — drives the sidebar's
    // "Tailor sessions" section so the user can see every analysis on this app.
    if (applicationId && mongoose.Types.ObjectId.isValid(applicationId)) {
      filter.applicationId = new mongoose.Types.ObjectId(applicationId);
    }

    const sessions = await TailorSession.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-jobDescription") // skip the bulky raw JD on the list view
      .lean();
    res.json(sessions);
  } catch (err) { next(err); }
});

router.get("/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const doc = await TailorSession.findOne({ _id: req.params.id, userId: user._id });
    if (!doc) throw new NotFoundError("Tailor session");
    const session = await reapStaleProcessing(doc);
    const out = session.toObject() as Record<string, unknown>;

    // Attach the editor payload (ResumeDocument + keyword-gap + score) once the
    // analysis has succeeded and the user has a master profile to derive from.
    if (session.status === "succeeded") {
      const master = await MasterProfile.findOne({ userId: user._id });
      if (master) Object.assign(out, buildTailorEditorPayload(session, master));
    }
    res.json(out);
  } catch (err) { next(err); }
});

router.patch("/sessions/:id/suggestions/:sIdx", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const decision = req.body?.decision;
    if (decision !== "accepted" && decision !== "rejected" && decision !== null) {
      res.status(400).json({ error: "decision must be 'accepted' | 'rejected' | null" });
      return;
    }
    const idx = parseInt(String(req.params.sIdx), 10);
    const session = await TailorSession.findOne({ _id: req.params.id, userId: user._id });
    if (!session) throw new NotFoundError("Tailor session");
    if (Number.isNaN(idx) || idx < 0 || idx >= session.suggestions.length) {
      res.status(400).json({ error: "Suggestion index out of range" });
      return;
    }
    session.suggestions[idx].decision = decision;
    await session.save();
    res.json(session);
  } catch (err) { next(err); }
});

/* Mark-applied + tailored-PDF generation moved off the deleted /tailor page and
 * the Typst engine. Tailored variants are now created per-application by the
 * Applications tailoring drawer (POST /applications/:id/tailor-resume) and
 * exported via Gotenberg (POST /resumes/render-pdf); Drafting → Applied is a
 * standard stage update (PUT /applications/:id). */

router.post("/sessions/:id/link/:applicationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const app = await Application.findOne({ _id: req.params.applicationId, userId: user._id });
    if (!app) throw new NotFoundError("Application");
    const session = await TailorSession.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { applicationId: app._id },
      { new: true }
    );
    if (!session) throw new NotFoundError("Tailor session");
    res.json(session);
  } catch (err) { next(err); }
});

export default router;
