import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { Application } from "../models/Application.js";
import { TailorSession } from "../models/TailorSession.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { upload } from "../middleware/upload.js";
import { AppError, ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { loadOrBuildDocument, withDerived, snapshot } from "../services/resume/store.js";
import { resumeDocumentSchema } from "../validators/resumeDocument.js";
import { composeHtml } from "../services/resume/html.js";
import { renderHtmlToPdf } from "../services/pdf/renderHtml.js";
import { rewriteDocument } from "../services/ai/rewrite.js";
import { analyzeJD, type AnalysisSectionFlag } from "../services/ai/tailor.js";
import { computeScore } from "../services/resume/score.js";
import { buildSuggestionChips } from "../services/resume/suggestions.js";
import { keywordCoverage, extractDocText, extractJdKeywords } from "../services/resume/keywords.js";
import type { RewriteScope, ResumeDocument as ResumeDocShape } from "../services/resume/types.js";

const router = Router();
router.use(ensureAuth);

/** Map the brain's section-type-keyed flags onto the live document's section
 *  ids + titles for the Studio "See the gap" step. */
function mapSectionFlags(doc: ResumeDocShape, flags: AnalysisSectionFlag[]) {
  const out: { sectionId: string; title: string; severity: AnalysisSectionFlag["severity"]; note: string }[] = [];
  for (const f of flags) {
    const sec = doc.sections.find((s) => s.type === f.section);
    if (sec) out.push({ sectionId: sec.id, title: sec.title, severity: f.severity, note: f.note });
  }
  return out;
}

const cloudinaryEnabled = () => !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

async function uploadToCloudinary(buffer: Buffer, originalName: string, userId: string): Promise<{ url: string; publicId: string }> {
  const { cloudinary } = await import("../config/cloudinary.js");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `hiretrail/${userId}/resumes`,
        resource_type: "image",
        access_mode: "public",
        public_id: `${Date.now()}-${originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    const { cloudinary } = await import("../config/cloudinary.js");
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

// GET all + aggregation for usage counts + per-resume funnel metrics
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resumes = await Resume.find({ userId: user._id }).sort({ uploadDate: -1 }).lean();

    // Pull every non-Drafting app's resumeId + current stage + stage-history
    // stages. We need stageHistory to compute "ever reached X" — current stage
    // alone misses the case "reached Interview, then Rejected".
    // Drafting is excluded because rates would be lies otherwise (the user
    // hasn't actually submitted those apps).
    const apps = await Application.find(
      { userId: user._id, resumeId: { $ne: null }, stage: { $ne: "Drafting" } },
      { resumeId: 1, stage: 1, "stageHistory.stage": 1 },
    ).lean();

    type Metrics = {
      total: number;
      responded: number; // moved past Applied (incl. Rejected — it IS a response)
      reachedOA: number;
      reachedInterview: number;
      offers: number;
    };
    const metricsByResume = new Map<string, Metrics>();

    for (const app of apps) {
      const key = String(app.resumeId);
      const m = metricsByResume.get(key) ?? { total: 0, responded: 0, reachedOA: 0, reachedInterview: 0, offers: 0 };
      m.total += 1;
      // Build the set of stages this app has ever been at (history + current).
      const stagesSeen = new Set<string>([app.stage]);
      for (const h of app.stageHistory || []) {
        if (h?.stage) stagesSeen.add(h.stage);
      }
      const reachedBeyondApplied = stagesSeen.has("OA") || stagesSeen.has("Interview") || stagesSeen.has("Offer") || stagesSeen.has("Rejected");
      if (reachedBeyondApplied) m.responded += 1;
      if (stagesSeen.has("OA") || stagesSeen.has("Interview") || stagesSeen.has("Offer")) m.reachedOA += 1;
      if (stagesSeen.has("Interview") || stagesSeen.has("Offer")) m.reachedInterview += 1;
      if (app.stage === "Offer") m.offers += 1;
      metricsByResume.set(key, m);
    }

    const result = resumes.map((r) => {
      const id = r._id.toString();
      const m = metricsByResume.get(id);
      return {
        ...r,
        applicationCount: m?.total ?? 0,
        // Send the rates as 0..1 fractions so the frontend can choose its own
        // display format (percent, ratio, sparkline, etc.). Null when the
        // sample is too small to be meaningful (< 1 submitted app).
        metrics: m && m.total > 0 ? {
          total: m.total,
          responseRate: m.responded / m.total,
          oaRate: m.reachedOA / m.total,
          interviewRate: m.reachedInterview / m.total,
          offerRate: m.offers / m.total,
        } : null,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

/* ===================== Resume engine (HTML→PDF) + structured document ===================== */

/** POST /render-pdf — render arbitrary {html, css} to a PDF via Gotenberg.
 *  The HTML is locked to a sanitized subset (no scripts / external resources)
 *  and Gotenberg is network-denied (see DEPLOY_GOTENBERG.md). Not tied to a
 *  resume id — the editor posts its current markup. */
const renderPdfSchema = z.object({
  html: z.string().min(1, "html is required").max(500_000),
  css: z.string().max(200_000).optional().default(""),
  filename: z.string().max(120).optional(),
});
router.post("/render-pdf", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = renderPdfSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const fullHtml = composeHtml(parsed.data.html, parsed.data.css);
    const { pdf, filename } = await renderHtmlToPdf({ html: fullHtml, filename: parsed.data.filename });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdf);
  } catch (err) { next(err); }
});

/** GET /:id/document — the structured ResumeDocument (with current score +
 *  suggestion chips). Builds + persists one from the master profile on first access. */
router.get("/:id/document", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);
    res.json(withDerived(docModel));
  } catch (err) { next(err); }
});

/** PUT /:id/document — replace the document wholesale (editor save). Snapshots
 *  the prior version for undo, then bumps version. */
router.put("/:id/document", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = resumeDocumentSchema.safeParse(req.body?.document ?? req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);

    snapshot(docModel, "Manual edit");
    docModel.document = { meta: parsed.data.meta, sections: parsed.data.sections, style: parsed.data.style };
    docModel.version += 1;
    await docModel.save();
    res.json(withDerived(docModel));
  } catch (err) { next(err); }
});

/** GET /:id/rewrite-suggestions — contextual chips derived from the gap analysis. */
router.get("/:id/rewrite-suggestions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);
    const gap = keywordCoverage(docModel.jdKeywords, extractDocText(docModel.document));
    res.json({ suggestions: buildSuggestionChips(docModel.document, gap), gap });
  } catch (err) { next(err); }
});

/** POST /:id/analyze-gap {jobDescription} — Step 1 "See the gap", AI-driven.
 *  The LLM brain (analyzeJD) extracts the role's REAL requirements (noise
 *  stripped), a per-section read, and the fit; we persist the cleaned keyword
 *  set on the document AND on the doc's TailorSession (one per doc, updated in
 *  place so re-analysis doesn't spam sessions). The COVERAGE ring + match score
 *  stay deterministic — computed against the actual document with those keywords
 *  — so the number never lies. With no/short JD we fall back to the document's
 *  stored keywords (no LLM). AI failure surfaces as an error (fail-in-place). */
const analyzeGapSchema = z.object({ jobDescription: z.string().max(40_000).optional().default("") });
router.post("/:id/analyze-gap", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = analyzeGapSchema.safeParse(req.body);
    const jd = (parsed.success ? parsed.data.jobDescription : "").trim();
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);

    let flags: AnalysisSectionFlag[] = [];
    let fit: { fitScore: number; fitGrade: string; summary: string; matchedSkills: string[]; missingSkills: string[] } | null = null;

    if (jd.length >= 20) {
      const { analysis } = await analyzeJD(user._id, { jobDescription: jd, jobTitle: resume.targetRole || "" });
      const kws = analysis.jdKeywords.length ? analysis.jdKeywords : extractJdKeywords(jd);

      const fields = {
        userId: user._id,
        jobTitle: resume.targetRole || "",
        jobDescription: jd.slice(0, 30_000),
        status: "succeeded" as const,
        fitScore: analysis.fitScore,
        fitGrade: analysis.fitGrade,
        summary: analysis.summary,
        jdKeywords: kws,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
        sectionFlags: analysis.sectionFlags,
        suggestions: analysis.suggestions.map((s) => ({ ...s, decision: null })),
      };

      const existing = docModel.tailorSessionId
        ? await TailorSession.findOne({ _id: docModel.tailorSessionId, userId: user._id })
        : null;
      if (existing) {
        Object.assign(existing, fields);
        await existing.save();
      } else {
        const created = await TailorSession.create({ ...fields, applicationId: null });
        docModel.tailorSessionId = created._id;
      }

      docModel.jdKeywords = kws;
      await docModel.save();
      flags = analysis.sectionFlags;
      fit = {
        fitScore: analysis.fitScore, fitGrade: analysis.fitGrade, summary: analysis.summary,
        matchedSkills: analysis.matchedSkills, missingSkills: analysis.missingSkills,
      };
    }

    const gap = keywordCoverage(docModel.jdKeywords, extractDocText(docModel.document));
    res.json({
      gap,
      sectionFlags: mapSectionFlags(docModel.document, flags),
      suggestions: buildSuggestionChips(docModel.document, gap),
      score: computeScore(docModel.document, docModel.jdKeywords),
      fit,
    });
  } catch (err) { next(err); }
});

/** POST /:id/document/bind-session {tailorSessionId} — bind a resume's document
 *  to an application's analysis: copy the session's cleaned JD keywords onto the
 *  document so the deterministic coverage/score target the APPLICATION's posting,
 *  not whatever the resume was last tailored against. Lets the Applications
 *  tailoring drawer reuse a succeeded analysis (skip Step 1) honestly. */
const bindSessionSchema = z.object({ tailorSessionId: z.string().min(1) });
router.post("/:id/document/bind-session", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = bindSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const session = await TailorSession.findOne({ _id: parsed.data.tailorSessionId, userId: user._id });
    if (!session) throw new NotFoundError("Tailor session");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);

    const kws = session.jdKeywords?.length
      ? [...session.jdKeywords]
      : [...session.matchedSkills, ...session.missingSkills];
    docModel.jdKeywords = kws;
    docModel.tailorSessionId = session._id;
    await docModel.save();

    const gap = keywordCoverage(docModel.jdKeywords, extractDocText(docModel.document));
    res.json({
      document: withDerived(docModel),
      gap,
      sectionFlags: mapSectionFlags(docModel.document, session.sectionFlags),
      score: computeScore(docModel.document, docModel.jdKeywords),
      fit: {
        fitScore: session.fitScore, fitGrade: session.fitGrade, summary: session.summary,
        matchedSkills: session.matchedSkills, missingSkills: session.missingSkills,
      },
    });
  } catch (err) { next(err); }
});

/** POST /:id/ai-rewrite — section-scoped rewrite (strict no-fabrication).
 *  Returns the new document + a field-level diff + {before,after} score. */
const aiRewriteSchema = z.object({
  scope: z.union([
    z.literal("all"),
    z.object({ sectionId: z.string().optional(), entryId: z.string().optional() }),
  ]).default("all"),
  instruction: z.string().max(500).optional(),
  preset: z.string().max(40).optional(),
});
router.post("/:id/ai-rewrite", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = aiRewriteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);

    const before = computeScore(docModel.document, docModel.jdKeywords);
    const result = await rewriteDocument({
      userId: user._id,
      document: docModel.document,
      scope: parsed.data.scope as RewriteScope | "all",
      instruction: parsed.data.instruction,
      preset: parsed.data.preset,
      jdKeywords: docModel.jdKeywords,
      targetRole: resume.targetRole || "",
    });

    if (result.changedPaths.length > 0) {
      // Snapshot the pre-rewrite doc so the UI can undo this rewrite.
      snapshot(docModel, `Before AI rewrite${typeof parsed.data.scope === "object" ? "" : " (all)"}`);
      docModel.document = result.document;
      docModel.version += 1;
      await docModel.save();
    }
    const after = computeScore(docModel.document, docModel.jdKeywords);

    res.json({
      document: withDerived(docModel),
      changes: result.changes,
      changedPaths: result.changedPaths,
      score: { before, after },
    });
  } catch (err) { next(err); }
});

/** POST /:id/revert {toVersion} — restore a prior snapshot from history. */
router.post("/:id/revert", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const toVersion = Number(req.body?.toVersion);
    if (!Number.isInteger(toVersion)) throw new AppError("toVersion (integer) is required.", 400);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);

    const snap = docModel.history.find((h) => h.version === toVersion);
    if (!snap) throw new AppError(`No snapshot for version ${toVersion}.`, 404);

    // Snapshot the current state first so the revert itself is undoable.
    snapshot(docModel, `Before revert to v${toVersion}`);
    docModel.document = JSON.parse(JSON.stringify(snap.document));
    docModel.version += 1;
    await docModel.save();
    res.json(withDerived(docModel));
  } catch (err) { next(err); }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id }).lean();
    if (!resume) throw new NotFoundError("Resume");
    res.json(resume);
  } catch (err) { next(err); }
});

// POST create (multipart optional)
router.post("/", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const { name, targetRole, fileName, tags } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Resume name is required" });
      return;
    }

    // Parse tags — multipart sends as JSON string
    let parsedTags: string[] = [];
    if (tags) {
      try { parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags; } catch { parsedTags = []; }
    }

    let fileUrl = "";
    let filePublicId = "";

    if (req.file && cloudinaryEnabled()) {
      const result = await uploadToCloudinary(req.file.buffer, req.file.originalname, user._id.toString());
      fileUrl = result.url;
      filePublicId = result.publicId;
    }

    const resume = await Resume.create({
      userId: user._id,
      name: name.trim(),
      targetRole: targetRole?.trim() || "",
      tags: parsedTags.map((t: string) => t.trim()).filter(Boolean),
      fileName: fileName?.trim() || req.file?.originalname || "",
      fileUrl,
      filePublicId,
    });

    res.status(201).json(resume);
  } catch (err) { next(err); }
});

// PUT update (multipart optional)
router.put("/:id", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");

    const { name, targetRole, fileName, tags } = req.body;
    // Track per-field changes so we can append one descriptive version
    // entry summarising the diff. Order matters for stable rendering.
    const changes: string[] = [];

    if (name !== undefined && name.trim() !== resume.name) {
      changes.push(`Renamed to "${name.trim()}"`);
      resume.name = name.trim();
    }
    if (targetRole !== undefined && targetRole.trim() !== resume.targetRole) {
      changes.push(targetRole.trim() ? `Target role → "${targetRole.trim()}"` : "Cleared target role");
      resume.targetRole = targetRole.trim();
    }
    if (fileName !== undefined && fileName.trim() !== resume.fileName) {
      // File-name-only changes (no new upload) aren't usually worth noting on
      // their own; we'll catch them only when nothing else changed.
      if (changes.length === 0) changes.push(`File name → "${fileName.trim()}"`);
      resume.fileName = fileName.trim();
    }
    if (tags !== undefined) {
      let parsedTags: string[] = [];
      try { parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags; } catch { parsedTags = []; }
      const next = parsedTags.map((t: string) => t.trim()).filter(Boolean);
      const prev = resume.tags || [];
      const sameSet = next.length === prev.length && next.every((t) => prev.includes(t));
      if (!sameSet) {
        changes.push(`Tags updated (${next.length} tag${next.length === 1 ? "" : "s"})`);
        resume.tags = next;
      }
    }

    // If new file uploaded, replace old one
    if (req.file && cloudinaryEnabled()) {
      // Delete old file from Cloudinary
      if (resume.filePublicId) {
        await deleteFromCloudinary(resume.filePublicId);
      }
      const result = await uploadToCloudinary(req.file.buffer, req.file.originalname, user._id.toString());
      resume.fileUrl = result.url;
      resume.filePublicId = result.publicId;
      if (!fileName) resume.fileName = req.file.originalname;
      changes.push(`Replaced file (${req.file.originalname})`);
    }

    if (changes.length > 0) {
      resume.versions.push({ timestamp: new Date(), summary: changes.join(" · ") });
      // Cap the history at 50 entries so the document doesn't grow unbounded
      // for users who re-edit a resume often. Oldest entries drop off first.
      if (resume.versions.length > 50) {
        resume.versions = resume.versions.slice(-50);
      }
    }

    await resume.save();
    res.json(resume);
  } catch (err) { next(err); }
});

// DELETE (removes Cloudinary asset when present)
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    if (resume.isProtected) throw new ForbiddenError("This resume is protected and cannot be deleted");

    if (resume.filePublicId) {
      await deleteFromCloudinary(resume.filePublicId);
    }

    await User.updateMany({ primaryResumeId: resume._id }, { $set: { primaryResumeId: null } });
    await resume.deleteOne();
    res.json({ message: "Resume deleted" });
  } catch (err) { next(err); }
});

export default router;
