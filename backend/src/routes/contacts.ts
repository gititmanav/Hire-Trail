import { Router, Request, Response, NextFunction } from "express";
import { Contact } from "../models/Contact.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createContactSchema,
  updateContactSchema,
} from "../validators/contacts.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(ensureAuth);

// GET all — supports pagination
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find({ userId: user._id })
        .sort({ lastContactDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments({ userId: user._id }),
    ]);

    res.json({
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET one
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: user._id,
    }).lean();
    if (!contact) throw new NotFoundError("Contact");
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

// POST create
router.post(
  "/",
  validate(createContactSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const contact = await Contact.create({
        ...req.body,
        userId: user._id,
      });
      res.status(201).json(contact);
    } catch (err) {
      next(err);
    }
  }
);

// PUT update
router.put(
  "/:id",
  validate(updateContactSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = { ...req.body };

      if (data.lastContactDate) {
        data.lastContactDate = new Date(data.lastContactDate);
      }

      const contact = await Contact.findOneAndUpdate(
        { _id: req.params.id, userId: user._id },
        { $set: data },
        { new: true, runValidators: true }
      );
      if (!contact) throw new NotFoundError("Contact");
      res.json(contact);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const result = await Contact.findOneAndDelete({
        _id: req.params.id,
        userId: user._id,
      });
      if (!result) throw new NotFoundError("Contact");
      res.json({ message: "Contact deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;