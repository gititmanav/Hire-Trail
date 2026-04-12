import { Router, Request, Response, NextFunction } from "express";
import { Notification } from "../models/Notification.js";
import { ensureAuth, getUser } from "../middleware/auth.js";

const router = Router();
router.use(ensureAuth);

// GET paginated list
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Notification.find({ userId: user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ userId: user._id }),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET unread count
router.get("/unread-count", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const count = await Notification.countDocuments({ userId: user._id, read: false });
    res.json({ count });
  } catch (err) { next(err); }
});

// PUT mark one read
router.put("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  } catch (err) { next(err); }
});

// PUT mark all read
router.put("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await Notification.updateMany(
      { userId: user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) { next(err); }
});

export default router;
