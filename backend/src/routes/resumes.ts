import { Router, Request, Response, NextFunction } from "express";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { Application } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const router = Router();
router.use(ensureAuth);

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
