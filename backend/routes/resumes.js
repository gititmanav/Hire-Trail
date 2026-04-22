import { Router } from "express";
import { ObjectId } from "mongodb";
import multer from "multer";
import { getDB } from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";
import {
  uploadBuffer,
  destroyAsset,
  isCloudinaryConfigured,
} from "../config/cloudinary.js";

const router = Router();

router.use(ensureAuth);

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Only PDF or Word documents are allowed"));
    }
    cb(null, true);
  },
});

// GET all resumes for current user
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const resumes = await db
      .collection("resumes")
      .find({ userId: req.user._id.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    const appCounts = await db
      .collection("applications")
      .aggregate([
        {
          $match: { userId: req.user._id.toString(), resumeId: { $ne: null } },
        },
        { $group: { _id: "$resumeId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = {};
    appCounts.forEach((item) => {
      countMap[item._id] = item.count;
    });

    const enriched = resumes.map((r) => ({
      ...r,
      applicationCount: countMap[r._id.toString()] || 0,
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("Get resumes error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET all tags used by the current user
router.get("/tags", async (req, res) => {
  try {
    const db = getDB();
    const tags = await db
      .collection("resumes")
      .distinct("tags", { userId: req.user._id.toString() });
    return res.json(tags.filter(Boolean).sort());
  } catch (err) {
    console.error("Get tags error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET single resume
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const resume = await db.collection("resumes").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }
    return res.json(resume);
  } catch (err) {
    console.error("Get resume error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw))
    return raw.map((t) => String(t).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((t) => String(t).trim()).filter(Boolean);
    }
  } catch {
    /* not JSON, fall through */
  }
  return String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// POST create resume (accepts multipart for file upload or JSON without file)
router.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const { name, targetRole } = req.body;
      const tags = parseTags(req.body.tags);

      if (!name) {
        return res.status(400).json({ error: "Resume name is required" });
      }

      const now = new Date();
      const userId = req.user._id.toString();
      const newResume = {
        userId,
        name,
        targetRole: targetRole || "",
        tags,
        fileName: "",
        fileType: "",
        fileSize: 0,
        cloudinaryUrl: "",
        cloudinaryPublicId: "",
        uploadDate: now,
        createdAt: now,
        updatedAt: now,
      };

      if (req.file) {
        if (!isCloudinaryConfigured()) {
          return res
            .status(500)
            .json({ error: "File storage is not configured on this server" });
        }
        const result = await uploadBuffer(req.file.buffer, {
          folder: `hiretrail/resumes/${userId}`,
          filename: req.file.originalname,
        });
        newResume.fileName = req.file.originalname;
        newResume.fileType = req.file.mimetype;
        newResume.fileSize = req.file.size;
        newResume.cloudinaryUrl = result.secure_url;
        newResume.cloudinaryPublicId = result.public_id;
      }

      const db = getDB();
      const result = await db.collection("resumes").insertOne(newResume);
      newResume._id = result.insertedId;
      return res.status(201).json(newResume);
    } catch (err) {
      console.error("Create resume error:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  },
);

// PUT update resume (metadata and optionally replace file)
router.put(
  "/:id",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const db = getDB();
      const existing = await db.collection("resumes").findOne({
        _id: new ObjectId(req.params.id),
        userId: req.user._id.toString(),
      });

      if (!existing) {
        return res.status(404).json({ error: "Resume not found" });
      }

      const { name, targetRole } = req.body;
      const updates = {
        name: name ?? existing.name,
        targetRole: targetRole ?? existing.targetRole,
        updatedAt: new Date(),
      };

      if (req.body.tags !== undefined) {
        updates.tags = parseTags(req.body.tags);
      }

      if (req.file) {
        if (!isCloudinaryConfigured()) {
          return res
            .status(500)
            .json({ error: "File storage is not configured on this server" });
        }
        // Remove old asset if present
        if (existing.cloudinaryPublicId) {
          try {
            await destroyAsset(existing.cloudinaryPublicId);
          } catch (e) {
            console.warn("Cloudinary destroy failed:", e.message);
          }
        }
        const result = await uploadBuffer(req.file.buffer, {
          folder: `hiretrail/resumes/${req.user._id.toString()}`,
          filename: req.file.originalname,
        });
        updates.fileName = req.file.originalname;
        updates.fileType = req.file.mimetype;
        updates.fileSize = req.file.size;
        updates.cloudinaryUrl = result.secure_url;
        updates.cloudinaryPublicId = result.public_id;
      }

      await db
        .collection("resumes")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });

      const updated = await db
        .collection("resumes")
        .findOne({ _id: new ObjectId(req.params.id) });
      return res.json(updated);
    } catch (err) {
      console.error("Update resume error:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  },
);

// DELETE resume
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const existing = await db.collection("resumes").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (!existing) {
      return res.status(404).json({ error: "Resume not found" });
    }

    if (existing.cloudinaryPublicId) {
      try {
        await destroyAsset(existing.cloudinaryPublicId);
      } catch (e) {
        console.warn("Cloudinary destroy failed:", e.message);
      }
    }

    await db.collection("resumes").deleteOne({ _id: existing._id });

    return res.json({ message: "Resume deleted" });
  } catch (err) {
    console.error("Delete resume error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
