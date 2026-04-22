import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();

router.use(ensureAuth);

// GET all contacts for current user
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const contacts = await db
      .collection("contacts")
      .find({ userId: req.user._id.toString() })
      .sort({ lastContactDate: -1 })
      .toArray();
    return res.json(contacts);
  } catch (err) {
    console.error("Get contacts error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET single contact
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const contact = await db.collection("contacts").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    return res.json(contact);
  } catch (err) {
    console.error("Get contact error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST create contact
router.post("/", async (req, res) => {
  try {
    const { name, company, role, linkedinUrl, connectionSource, notes } =
      req.body;

    if (!name || !company) {
      return res.status(400).json({ error: "Name and company are required" });
    }

    const now = new Date();
    const newContact = {
      userId: req.user._id.toString(),
      name,
      company,
      role: role || "",
      linkedinUrl: linkedinUrl || "",
      connectionSource: connectionSource || "",
      lastContactDate: now,
      notes: notes || "",
      createdAt: now,
      updatedAt: now,
    };

    const db = getDB();
    const result = await db.collection("contacts").insertOne(newContact);
    newContact._id = result.insertedId;
    return res.status(201).json(newContact);
  } catch (err) {
    console.error("Create contact error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT update contact
router.put("/:id", async (req, res) => {
  try {
    const db = getDB();
    const existing = await db.collection("contacts").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const {
      name,
      company,
      role,
      linkedinUrl,
      connectionSource,
      lastContactDate,
      notes,
    } = req.body;

    const updates = {
      name: name ?? existing.name,
      company: company ?? existing.company,
      role: role ?? existing.role,
      linkedinUrl: linkedinUrl ?? existing.linkedinUrl,
      connectionSource: connectionSource ?? existing.connectionSource,
      lastContactDate: lastContactDate
        ? new Date(lastContactDate)
        : existing.lastContactDate,
      notes: notes ?? existing.notes,
      updatedAt: new Date(),
    };

    await db
      .collection("contacts")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });

    const updated = await db
      .collection("contacts")
      .findOne({ _id: new ObjectId(req.params.id) });
    return res.json(updated);
  } catch (err) {
    console.error("Update contact error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE contact
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("contacts").deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id.toString(),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    return res.json({ message: "Contact deleted" });
  } catch (err) {
    console.error("Delete contact error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
