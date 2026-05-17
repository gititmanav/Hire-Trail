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
import { MasterProfile, type IMasterProfile } from "../models/MasterProfile.js";
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

type ProfileSlice = {
  contact: unknown;
  summary: string;
  experiences: unknown[];
  projects: unknown[];
  education: unknown[];
  skills: unknown[];
  certifications: unknown[];
};

/** Some models (esp. on free tiers) return degenerate empty arrays despite the merge
 *  prompt's "never drop" rule. If the merge would drop content the master already had,
 *  reject it and keep the master untouched. Returns true if the merge is safe to apply. */
function mergeIsSafe(master: ProfileSlice, merged: ProfileSlice): boolean {
  const fields: (keyof ProfileSlice)[] = ["experiences", "projects", "education", "skills", "certifications"];
  for (const f of fields) {
    const m = (master[f] as unknown[]).length;
    const out = (merged[f] as unknown[]).length;
    if (m > 0 && out < m) return false;
  }
  return true;
}

function profileFromMaster(master: ProfileSlice): ProfileSlice {
  return {
    contact: master.contact,
    summary: master.summary,
    experiences: master.experiences,
    projects: master.projects,
    education: master.education,
    skills: master.skills,
    certifications: master.certifications,
  };
}

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

/** Stale processing reaper — protects against the rare case where the LLM worker died
 *  mid-parse (e.g. Vercel function timeout). 90s is generous: an LLM parse typically
 *  finishes in 10–30 seconds. */
const PARSE_TIMEOUT_MS = 90_000;

async function reapStaleParse(profile: IMasterProfile): Promise<IMasterProfile> {
  if (profile.parseStatus !== "processing") return profile;
  const started = profile.parseStartedAt ? new Date(profile.parseStartedAt).getTime() : 0;
  if (Date.now() - started < PARSE_TIMEOUT_MS) return profile;
  profile.parseStatus = "failed";
  profile.parseError = "Parse took too long — please retry.";
  await profile.save();
  return profile;
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const doc = await MasterProfile.findOne({ userId: user._id });
    if (!doc) { res.json(null); return; }
    const profile = await reapStaleParse(doc);
    res.json(profile.toObject());
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

/* ----------------- Parse worker (shared by both endpoints) ----------------- */

/** Runs the LLM parse + merge against an existing master profile in the background
 *  and writes the result back. Always flips parseStatus to "idle" (success) or
 *  "failed" with parseError. Designed to be invoked after the HTTP response was
 *  already sent — never throws to the caller. */
async function runParseWorker(
  userId: string,
  resumeId: string,
  buffer: Buffer
): Promise<void> {
  try {
    const { profile, provider, modelId } = await parseResumePdf(buffer, userId);

    const existing = await MasterProfile.findOne({ userId });
    let finalProfile = profile;
    let finalProvider = provider;
    let finalModelId = modelId;
    let mergeUsed = false;
    const dbUserForMerge = await User.findById(userId).select("mergeResumesEnabled");
    const mergeEnabled = dbUserForMerge?.mergeResumesEnabled !== false;
    if (existing && hasContent(existing) && mergeEnabled) {
      const merged = await mergeProfilesAI(userId, existing, profile);
      if (mergeIsSafe(existing, merged.merged)) {
        finalProfile = merged.merged;
        finalProvider = merged.provider;
        finalModelId = merged.modelId;
        mergeUsed = true;
      } else {
        console.warn(`[master-profile] merge dropped content for user ${userId}; keeping master`);
        finalProfile = profileFromMaster(existing) as typeof profile;
      }
    }

    await MasterProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...finalProfile,
          sourceResumeId: resumeId,
          lastParsedAt: new Date(),
          lastParsedProvider: `${finalProvider}:${finalModelId}${mergeUsed ? " (merged)" : existing && hasContent(existing) && mergeEnabled ? " (merge-rejected)" : ""}`,
          parseStatus: "idle",
          parseError: "",
          parseStartedAt: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    let message = "Failed to parse resume.";
    if (err instanceof z.ZodError) {
      message = "AI returned invalid resume structure. Try a different model or upload a cleaner PDF.";
    } else if (err instanceof Error) {
      message = err.message;
    }
    await MasterProfile.findOneAndUpdate(
      { userId },
      { $set: { parseStatus: "failed", parseError: message, parseStartedAt: null } }
    );
    console.error(`[master-profile] parse worker failed for user ${userId}:`, err);
  }
}

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

    // 1. Fetch the PDF (fast, IO bound). Better to surface a network failure synchronously
    //    than to flip the profile into "processing" only to discover we can't read the file.
    const response = await fetch(resume.fileUrl);
    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch resume PDF (${response.status})` });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Mark the master profile as processing + return immediately.
    const profile = await MasterProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { parseStatus: "processing", parseError: "", parseStartedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(202).json(profile);

    // 3. Run LLM in background.
    void runParseWorker(user._id.toString(), resume._id.toString(), buffer);
  } catch (err) {
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

    // 1. Upload the PDF to Cloudinary (IO-bound, fast). Doing this synchronously gives
    //    us a Resume row to return to the client before the LLM parse runs.
    let fileUrl = "";
    let filePublicId = "";
    if (cloudinaryEnabled()) {
      try {
        const result = await uploadResumeToCloudinary(buffer, originalName, user._id.toString());
        fileUrl = result.url;
        filePublicId = result.publicId;
      } catch (err) {
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
      targetRole: "",
      tags: [],
      fileName: originalName,
      fileUrl,
      filePublicId,
    });

    // 2. If the user had no primary resume, set this one as primary.
    const dbUser = await User.findById(user._id).select("primaryResumeId");
    if (dbUser && !dbUser.primaryResumeId) {
      await User.findByIdAndUpdate(user._id, { primaryResumeId: resume._id });
    }

    // 3. Flip the master profile into "processing" so the frontend can poll for
    //    completion (and resume polling after a page refresh).
    const profile = await MasterProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { parseStatus: "processing", parseError: "", parseStartedAt: new Date(), sourceResumeId: resume._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(202).json({ profile, resume });

    // 4. Run LLM in background.
    void runParseWorker(user._id.toString(), resume._id.toString(), buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
