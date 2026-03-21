import { Router, Request, Response, NextFunction } from "express";
import { Resume } from "../models/Resume.js";
import { Application } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { NotFoundError } from "../errors/AppError.js";
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
        resource_type: "raw",
        public_id: `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
        format: "pdf",
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
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

// GET all + aggregation for usage counts
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resumes = await Resume.find({ userId: user._id }).sort({ uploadDate: -1 }).lean();

    // Get application count per resume
    const counts = await Application.aggregate([
      { $match: { userId: user._id, resumeId: { $ne: null } } },
      { $group: { _id: "$resumeId", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

    const result = resumes.map((r) => ({
      ...r,
      applicationCount: countMap[r._id.toString()] || 0,
    }));

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

// POST create — with optional file upload
router.post("/", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const { name, targetRole, fileName } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Resume name is required" });
      return;
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
      fileName: fileName?.trim() || req.file?.originalname || "",
      fileUrl,
      filePublicId,
    });

    res.status(201).json(resume);
  } catch (err) { next(err); }
});

// PUT update — with optional new file upload
router.put("/:id", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");

    const { name, targetRole, fileName } = req.body;
    if (name !== undefined) resume.name = name.trim();
    if (targetRole !== undefined) resume.targetRole = targetRole.trim();
    if (fileName !== undefined) resume.fileName = fileName.trim();

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
    }

    await resume.save();
    res.json(resume);
  } catch (err) { next(err); }
});

// DELETE — also removes file from Cloudinary
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const resume = await Resume.findOne({ _id: req.params.id, userId: user._id });
    if (!resume) throw new NotFoundError("Resume");

    if (resume.filePublicId) {
      await deleteFromCloudinary(resume.filePublicId);
    }

    await resume.deleteOne();
    res.json({ message: "Resume deleted" });
  } catch (err) { next(err); }
});

export default router;
