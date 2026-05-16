/**
 * Tailor — JD analysis + per-application tailored variants.
 *
 *   POST   /api/tailor/analyze                — runs JD analysis, persists a new session
 *   GET    /api/tailor/sessions/:id           — fetch a session
 *   GET    /api/tailor/sessions               — list user's sessions (most recent first)
 *   PATCH  /api/tailor/sessions/:id/suggestions/:sIdx
 *                                              — set decision: "accepted" | "rejected"
 *   POST   /api/tailor/sessions/:id/link/:applicationId
 *                                              — attach a session to an existing tracked application
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { TailorSession } from "../models/TailorSession.js";
import { Application } from "../models/Application.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { analyzeJD } from "../services/ai/tailor.js";
import { applyAcceptedSuggestions } from "../services/pdf/applySuggestions.js";
import { renderResumePdf } from "../services/pdf/renderer.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

const analyzeSchema = z.object({
  jobDescription: z.string().min(50, "Job description seems too short."),
  jobTitle: z.string().optional().default(""),
  company: z.string().optional().default(""),
  url: z.string().optional().default(""),
  applicationId: z.string().optional(),
});

router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { analysis, provider, modelId } = await analyzeJD(user._id, {
      jobTitle: parsed.data.jobTitle,
      company: parsed.data.company,
      url: parsed.data.url,
      jobDescription: parsed.data.jobDescription,
    });

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
      fitScore: analysis.fitScore,
      fitGrade: analysis.fitGrade,
      summary: analysis.summary,
      matchedSkills: analysis.matchedSkills,
      missingSkills: analysis.missingSkills,
      suggestions: analysis.suggestions.map((s) => ({ ...s, decision: null })),
      provider,
      modelId,
    });

    res.status(201).json(session);
  } catch (err) {
    if (err instanceof Error && err.message.includes("No master profile")) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
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
    const session = await TailorSession.findOne({ _id: req.params.id, userId: user._id }).lean();
    if (!session) throw new NotFoundError("Tailor session");
    res.json(session);
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
