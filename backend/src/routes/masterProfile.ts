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

import { ensureAuth, getUser } from "../middleware/auth.js";
import { blockDemoUser } from "../middleware/blockDemoUser.js";
import { upload } from "../middleware/upload.js";
import { MasterProfile } from "../models/MasterProfile.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { resumeProfileSchema, startResumeImport, undoLastImport } from "../services/ai/features/resumeImport.js";
import { reviveAiJobs } from "../services/ai/jobs.js";
import type { AiUser } from "../services/ai/gateway.js";
import { AppError, NotFoundError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const router = Router();
router.use(ensureAuth);

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
    let doc = await MasterProfile.findOne({ userId: user._id });
    if (!doc) { res.json(null); return; }
    // The Profile page polls this during an import: pick up a stalled job.
    if (doc.parseStatus === "processing") {
      await reviveAiJobs(user._id);
      doc = (await MasterProfile.findOne({ userId: user._id })) ?? doc;
    }
    res.json(doc.toObject());
  } catch (err) { next(err); }
});

/** POST /undo-import — put the profile back as it was before the last import. */
router.post("/undo-import", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!(await undoLastImport(user._id))) throw new AppError("There's no import to undo.", 404);
    res.json((await MasterProfile.findOne({ userId: user._id }))?.toObject() ?? null);
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

/** The gateway's view of the signed-in user. */
async function aiUser(req: Request): Promise<AiUser> {
  const user = getUser(req);
  return ((await User.findById(user._id).select("email aiOverride").lean()) ?? { _id: user._id, email: user.email }) as AiUser;
}

/* ----------------- Parse from existing resume ----------------- */

router.post("/parse-from-resume/:resumeId", blockDemoUser, async (req: Request, res: Response, next: NextFunction) => {
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

    // 2. Read the PDF and queue the import — a scan or a refused lane is
    //    answered here, before anything is marked "processing".
    await startResumeImport(await aiUser(req), resume._id, buffer);
    res.status(202).json(await MasterProfile.findOne({ userId: user._id }));
  } catch (err) {
    next(err);
  }
});

/* ----------------- Upload + parse in one shot (empty state) ----------------- */

router.post("/upload-and-parse", blockDemoUser, upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
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

    // 3. Read the PDF and queue the import (the profile flips to "processing";
    //    the frontend polls it, and resumes polling after a refresh). A scan
    //    or a refused lane is answered here — the resume itself stays saved.
    await startResumeImport(await aiUser(req), resume._id, buffer);
    const profile = await MasterProfile.findOne({ userId: user._id });
    res.status(202).json({ profile, resume });
  } catch (err) {
    next(err);
  }
});

export default router;
