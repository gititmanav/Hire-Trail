/**
 * Feedback endpoints.
 *
 *   POST   /api/feedback                 — any authenticated user submits feedback
 *   GET    /api/feedback/mine            — user's own submissions
 *   GET    /api/admin/feedback           — admin list (registered under admin.ts)
 *   PATCH  /api/admin/feedback/:id       — admin triage (status, severity, notes)
 *   GET    /api/admin/feedback/stats     — totals by type / status
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { ensureAuth, getUser } from "../middleware/auth.js";
import { Feedback, FEEDBACK_TYPES } from "../models/Feedback.js";

const router = Router();
router.use(ensureAuth);

const submitSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().min(3, "Title is too short").max(200),
  message: z.string().min(8, "Message is too short").max(8000),
  pageContext: z.string().max(200).optional().default(""),
  userAgent: z.string().max(500).optional().default(""),
  appVersion: z.string().max(40).optional().default(""),
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const fb = await Feedback.create({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      ...parsed.data,
    });
    res.status(201).json(fb);
  } catch (err) { next(err); }
});

router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const list = await Feedback.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  } catch (err) { next(err); }
});

export default router;
