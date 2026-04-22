import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();

router.use(ensureAuth);

// GET all deadlines for current user
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const deadlines = await db
      .collection("deadlines")
      .find({ userId: req.user._id.toString() })
      .sort({ dueDate: 1 })
      .toArray();
    return res.json(deadlines);
  } catch (err) {
    console.error("Get deadlines error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET single deadline
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const deadline = await db.collection("deadlines").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });
    if (!deadline) {
      return res.status(404).json({ error: "Deadline not found" });
    }
    return res.json(deadline);
  } catch (err) {
    console.error("Get deadline error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST create deadline
router.post("/", async (req, res) => {
  try {
    const { applicationId, type, dueDate, notes } = req.body;

    if (!type || !dueDate) {
      return res.status(400).json({ error: "Type and due date are required" });
    }

    const now = new Date();
    const newDeadline = {
      userId: req.user._id.toString(),
      applicationId: applicationId || null,
      type,
      dueDate: new Date(dueDate),
      completed: false,
      notes: notes || "",
      createdAt: now,
      updatedAt: now,
    };

    const db = getDB();
    const result = await db.collection("deadlines").insertOne(newDeadline);
    newDeadline._id = result.insertedId;
    return res.status(201).json(newDeadline);
  } catch (err) {
    console.error("Create deadline error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT update deadline
router.put("/:id", async (req, res) => {
  try {
    const db = getDB();
    const existing = await db.collection("deadlines").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (!existing) {
      return res.status(404).json({ error: "Deadline not found" });
    }

    const { applicationId, type, dueDate, completed, notes } = req.body;

    const updates = {
      applicationId: applicationId ?? existing.applicationId,
      type: type ?? existing.type,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      completed: completed ?? existing.completed,
      notes: notes ?? existing.notes,
      updatedAt: new Date(),
    };

    await db
      .collection("deadlines")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });

    const updated = await db
      .collection("deadlines")
      .findOne({ _id: new ObjectId(req.params.id) });
    return res.json(updated);
  } catch (err) {
    console.error("Update deadline error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE deadline
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("deadlines").deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Deadline not found" });
    }

    return res.json({ message: "Deadline deleted" });
  } catch (err) {
    console.error("Delete deadline error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
