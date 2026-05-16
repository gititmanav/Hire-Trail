/**
 * Master profile — one canonical career history per user.
 *
 *   GET  /api/master-profile                 → returns the master profile or null
 *   PUT  /api/master-profile                 → manual edits
 *   POST /api/master-profile/parse-from-resume/:resumeId
 *                                            → re-parse from an already-uploaded resume PDF
 *   POST /api/master-profile/upload-and-parse (multipart "file")
 *                                            → upload a PDF, save as a Resume,
 *                                              parse it, write into master profile,
 *                                              and set it as primary if user has none.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { parseResumePdf, resumeProfileSchema } from "../services/ai/resumeParser.js";
import { mergeProfilesAI } from "../services/ai/mergeProfiles.js";
import { NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const router = Router();
router.use(ensureAuth);

/** A master profile counts as "having content" once at least one section has data —
 *  used to decide whether a parse should overwrite (first time) or merge (subsequent). */
function hasContent(p: {
  summary: string;
  experiences: unknown[];
  projects: unknown[];
  education: unknown[];
  skills: unknown[];
  certifications: unknown[];
}): boolean {
  return (
    !!p.summary?.trim() ||
    p.experiences.length > 0 ||
    p.projects.length > 0 ||
    p.education.length > 0 ||
    p.skills.length > 0 ||
    p.certifications.length > 0
  );
}

const cloudinaryEnabled = () => !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

async function uploadResumeToCloudinary(buffer: Buffer, originalName: string, userId: string): Promise<{ url: string; publicId: string }> {
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

/* ----------------- GET / PUT ----------------- */

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const profile = await MasterProfile.findOne({ userId: user._id }).lean();
    res.json(profile ?? null);
  } catch (err) { next(err); }
});

const updateSchema = resumeProfileSchema.partial();

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const profile = await MasterProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: parsed.data },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (err) { next(err); }
});

/* ----------------- Parse from existing resume ----------------- */

router.post("/parse-from-resume/:resumeId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.resumeId, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");
    if (!resume.fileUrl) {
      res.status(400).json({ error: "Resume has no uploaded file to parse." });
      return;
    }

    const response = await fetch(resume.fileUrl);
    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch resume PDF (${response.status})` });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const { profile, provider, modelId } = await parseResumePdf(buffer, user._id);

    // If a master profile already exists, AI-merge instead of overwriting.
    const existing = await MasterProfile.findOne({ userId: user._id });
    let finalProfile = profile;
    let finalProvider = provider;
    let finalModelId = modelId;
    const dbUserForMerge = await User.findById(user._id).select("mergeResumesEnabled");
    const mergeEnabled = dbUserForMerge?.mergeResumesEnabled !== false;
    if (existing && hasContent(existing) && mergeEnabled) {
      const merged = await mergeProfilesAI(user._id, existing, profile);
      finalProfile = merged.merged;
      finalProvider = merged.provider;
      finalModelId = merged.modelId;
    }

    const saved = await MasterProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...finalProfile,
          sourceResumeId: resume._id,
          lastParsedAt: new Date(),
          lastParsedProvider: `${finalProvider}:${finalModelId}${existing && hasContent(existing) && mergeEnabled ? " (merged)" : ""}`,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ error: "AI returned invalid resume structure", details: err.flatten() });
      return;
    }
    next(err);
  }
});

/* ----------------- Upload + parse in one shot (empty state) ----------------- */

router.post("/upload-and-parse", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!req.file) {
      res.status(400).json({ error: "PDF file required" });
      return;
    }

    const buffer = req.file.buffer;
    const originalName = req.file.originalname;

    // 1. Parse first so we can return errors before uploading anywhere.
    const { profile, provider, modelId } = await parseResumePdf(buffer, user._id);

    // 2. Save the PDF as a Resume row (so it also appears on the Resumes page).
    let fileUrl = "";
    let filePublicId = "";
    if (cloudinaryEnabled()) {
      try {
        const result = await uploadResumeToCloudinary(buffer, originalName, user._id.toString());
        fileUrl = result.url;
        filePublicId = result.publicId;
      } catch (err) {
        // Non-fatal: profile still saves even if Cloudinary is unavailable.
        console.error("[masterProfile] Cloudinary upload failed:", err);
      }
    }

    const inferredName =
      (req.body.name as string | undefined)?.trim() ||
      originalName.replace(/\.[^.]+$/, "").trim() ||
      "Master resume";

    const resume = await Resume.create({
      userId: user._id,
      name: inferredName,
      targetRole: profile.contact.fullName ? "" : "",
      tags: [],
      fileName: originalName,
      fileUrl,
      filePublicId,
    });

    // 3. If a master profile already exists, AI-merge instead of overwriting.
    const existing = await MasterProfile.findOne({ userId: user._id });
    let finalProfile = profile;
    let finalProvider = provider;
    let finalModelId = modelId;
    const dbUserForMerge = await User.findById(user._id).select("mergeResumesEnabled");
    const mergeEnabled = dbUserForMerge?.mergeResumesEnabled !== false;
    if (existing && hasContent(existing) && mergeEnabled) {
      const merged = await mergeProfilesAI(user._id, existing, profile);
      finalProfile = merged.merged;
      finalProvider = merged.provider;
      finalModelId = merged.modelId;
    }

    const saved = await MasterProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...finalProfile,
          sourceResumeId: resume._id,
          lastParsedAt: new Date(),
          lastParsedProvider: `${finalProvider}:${finalModelId}${existing && hasContent(existing) && mergeEnabled ? " (merged)" : ""}`,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 4. If the user had no primary resume, set this one as primary.
    const dbUser = await User.findById(user._id).select("primaryResumeId");
    if (dbUser && !dbUser.primaryResumeId) {
      await User.findByIdAndUpdate(user._id, { primaryResumeId: resume._id });
    }

    res.status(201).json({ profile: saved, resume });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ error: "AI returned invalid resume structure", details: err.flatten() });
      return;
    }
    next(err);
  }
});

export default router;
