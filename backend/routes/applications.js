import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();

// All routes require authentication
router.use(ensureAuth);

// GET all applications for the current user
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const apps = await db
      .collection("applications")
      .find({ userId: req.user._id.toString() })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json(apps);
  } catch (err) {
    console.error("Get applications error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET single application
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const app = await db.collection("applications").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });
    if (!app) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.json(app);
  } catch (err) {
    console.error("Get application error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST create application
router.post("/", async (req, res) => {
  try {
    const { company, role, jobUrl, stage, notes, resumeId } = req.body;

    if (!company || !role) {
      return res
        .status(400)
        .json({ error: "Company and role are required" });
    }

    const now = new Date();
    const newApp = {
      // Data Model: userId is stored as a plain string while _id is an ObjectId;
      // this inconsistency causes silent failures in aggregation $lookup/$match across collections
      userId: req.user._id.toString(),
      company,
      role,
      jobUrl: jobUrl || "",
      applicationDate: now,
      stage: stage || "Applied",
      stageHistory: [{ stage: stage || "Applied", date: now }],
      notes: notes || "",
      resumeId: resumeId || null,
      createdAt: now,
      updatedAt: now,
    };

    const db = getDB();
    const result = await db.collection("applications").insertOne(newApp);
    newApp._id = result.insertedId;
    return res.status(201).json(newApp);
  } catch (err) {
    console.error("Create application error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT update application
router.put("/:id", async (req, res) => {
  try {
    const db = getDB();
    const existing = await db.collection("applications").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (!existing) {
      return res.status(404).json({ error: "Application not found" });
    }

    const { company, role, jobUrl, stage, notes, resumeId } = req.body;
    const now = new Date();

    const updates = {
      company: company ?? existing.company,
      role: role ?? existing.role,
      jobUrl: jobUrl ?? existing.jobUrl,
      notes: notes ?? existing.notes,
      resumeId: resumeId ?? existing.resumeId,
      updatedAt: now,
    };

    // Track stage changes with timestamps
    if (stage && stage !== existing.stage) {
      updates.stage = stage;
      updates.stageHistory = [
        ...(existing.stageHistory || []),
        { stage, date: now },
      ];
    }

    // Performance/Correctness: two separate DB round-trips with a race-condition window between them;
    // replace with findOneAndUpdate(..., { returnDocument: 'after' }) to fetch the updated doc atomically
    await db
      .collection("applications")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });

    const updated = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(req.params.id) });
    return res.json(updated);
  } catch (err) {
    console.error("Update application error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE application
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("applications").deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.json({ message: "Application deleted" });
  } catch (err) {
    console.error("Delete application error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
