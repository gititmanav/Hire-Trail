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
import { TailorSession, type ITailorSession } from "../models/TailorSession.js";
import { Application } from "../models/Application.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { analyzeJD } from "../services/ai/tailor.js";
import { runAnalyzeWorker } from "../services/ai/autoAnalyze.js";
import { applyAcceptedSuggestions } from "../services/pdf/applySuggestions.js";
import { renderResumePdf } from "../services/pdf/renderer.js";
import { NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";

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

router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
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
router.post("/init", async (req: Request, res: Response, next: NextFunction) => {
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
    const sessions = await TailorSession.find({ userId: user._id })
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
    res.json(session.toObject());
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

router.get("/sessions/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const session = await TailorSession.findOne({ _id: req.params.id, userId: user._id });
    if (!session) throw new NotFoundError("Tailor session");
    if (session.status === "processing") {
      res.status(409).json({ error: "Analysis is still running. Wait for it to finish before generating a PDF." });
      return;
    }
    if (session.status === "failed") {
      res.status(409).json({ error: session.errorMessage || "Analysis failed." });
      return;
    }

    const masterDoc = await MasterProfile.findOne({ userId: user._id });
    if (!masterDoc) {
      res.status(400).json({ error: "No master profile to render. Upload a resume on the Profile page first." });
      return;
    }

    const tailoredProfile = applyAcceptedSuggestions(masterDoc, session.suggestions);
    const { pdf, pages, warnings } = renderResumePdf(tailoredProfile);

    const baseName = [session.company || "resume", session.jobTitle || ""].filter(Boolean).join("-")
      .replace(/[^a-zA-Z0-9-]+/g, "_").slice(0, 60) || "resume";
    const filename = `hiretrail-${baseName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Resume-Pages", String(pages));
    if (warnings.length) res.setHeader("X-Resume-Warnings", encodeURIComponent(warnings.join(" | ")));
    res.end(pdf);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Typst compile failed")) {
      res.status(500).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/* -------------------- /mark-applied: Drafting → Applied with resume choice -------------------- */

const markAppliedSchema = z.object({
  resumeChoice: z.enum(["primary", "tailored"]),
});

const cloudinaryEnabled = () =>
  !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

async function uploadPdfToCloudinary(buffer: Buffer, baseName: string, userId: string): Promise<{ url: string; publicId: string }> {
  const { cloudinary } = await import("../config/cloudinary.js");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `hiretrail/${userId}/resumes`,
        resource_type: "image", // PDFs go through Cloudinary's image pipeline (same as resume uploads)
        access_mode: "public",
        public_id: `${Date.now()}-${baseName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

router.put("/sessions/:id/mark-applied", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = markAppliedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const session = await TailorSession.findOne({ _id: req.params.id, userId: user._id });
    if (!session) throw new NotFoundError("Tailor session");
    if (!session.applicationId) {
      res.status(400).json({ error: "This session isn't linked to an application yet." });
      return;
    }

    const application = await Application.findOne({ _id: session.applicationId, userId: user._id });
    if (!application) throw new NotFoundError("Linked application");
    if (application.stage !== "Drafting") {
      res.status(400).json({ error: `Application is already in stage "${application.stage}".` });
      return;
    }

    let resumeIdForApp: mongoose.Types.ObjectId | null = null;
    let createdTailoredResumeId: mongoose.Types.ObjectId | null = null;

    if (parsed.data.resumeChoice === "tailored") {
      // 1. Render the tailored PDF.
      if (session.status !== "succeeded") {
        res.status(409).json({ error: "Tailored resume isn't ready yet (analysis still running or failed)." });
        return;
      }
      const masterDoc = await MasterProfile.findOne({ userId: user._id });
      if (!masterDoc) {
        res.status(400).json({ error: "No master profile to render. Upload a resume on the Profile page first." });
        return;
      }
      const tailoredProfile = applyAcceptedSuggestions(masterDoc, session.suggestions);
      const { pdf } = renderResumePdf(tailoredProfile);

      // 2. Upload + create a Resume row tagged "tailored".
      const baseName = [session.company || "resume", session.jobTitle || ""].filter(Boolean).join("-")
        .replace(/[^a-zA-Z0-9-]+/g, "_").slice(0, 60) || "resume";

      let fileUrl = "";
      let filePublicId = "";
      if (cloudinaryEnabled()) {
        try {
          const result = await uploadPdfToCloudinary(pdf, baseName, user._id.toString());
          fileUrl = result.url;
          filePublicId = result.publicId;
        } catch (err) {
          console.error("[tailor] Cloudinary upload failed:", err);
          // Non-fatal: Resume row still created without a file URL.
        }
      }

      const resumeName = `Tailored — ${session.company || "Unknown"}${session.jobTitle ? ` / ${session.jobTitle}` : ""}`.slice(0, 200);
      const tailoredResume = await Resume.create({
        userId: user._id,
        name: resumeName,
        targetRole: session.jobTitle || "",
        tags: ["tailored"],
        fileName: `hiretrail-${baseName}.pdf`,
        fileUrl,
        filePublicId,
      });
      resumeIdForApp = tailoredResume._id as mongoose.Types.ObjectId;
      createdTailoredResumeId = resumeIdForApp;
    } else {
      // primary choice — fall back to user's current primary, if any.
      const dbUser = await User.findById(user._id).select("primaryResumeId");
      resumeIdForApp = (dbUser?.primaryResumeId as mongoose.Types.ObjectId | null) ?? null;
    }

    // Transition stage.
    application.stage = "Applied";
    application.stageHistory.push({ stage: "Applied", date: new Date() });
    if (resumeIdForApp) application.resumeId = resumeIdForApp;
    await application.save();

    res.json({ application, tailoredResumeId: createdTailoredResumeId });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Typst compile failed")) {
      res.status(500).json({ error: err.message });
      return;
    }
    next(err);
  }
});

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
