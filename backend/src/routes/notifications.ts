import { Router, Request, Response, NextFunction } from "express";
import { Notification } from "../models/Notification.js";
import { Application, STAGES, type Stage } from "../models/Application.js";
import { ensureAuth, getUser } from "../middleware/auth.js";

const router = Router();
router.use(ensureAuth);

// GET paginated list.
//   ?status=current → still needs attention (not yet dealt with): resolved:false
//   ?status=past    → already dealt with / archived: resolved:true
//   (omitted)       → everything, newest first
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const status = String(req.query.status ?? "");
    const filter: Record<string, unknown> = { userId: user._id };
    if (status === "current") filter.resolved = false;
    else if (status === "past") filter.resolved = true;

    const [data, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET unread count
router.get("/unread-count", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const count = await Notification.countDocuments({ userId: user._id, read: false, resolved: false });
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

// PUT dismiss — mark a notification "dealt with". It leaves the Current tab and
// moves to Past (resolved), where the user can still refer back to it. This is
// the default ✕ action in the Current view.
router.put("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { resolved: true, resolvedAt: new Date(), read: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  } catch (err) { next(err); }
});

// DELETE one — permanently remove a notification (the ✕ in the Past tab).
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) { next(err); }
});

// PUT confirm — user accepts the AI's stage update; just marks the notification resolved.
router.put("/:id/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { resolved: true, resolvedAt: new Date(), read: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  } catch (err) { next(err); }
});

// PUT revert — user rejects the AI's stage update; restore the prior stage and pop the auto-added history entry.
router.put("/:id/revert", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const notif = await Notification.findOne({ _id: req.params.id, userId: user._id });
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    if (!notif.previousStage || !notif.applicationId) {
      return res.status(400).json({ error: "Nothing to revert on this notification." });
    }
    if (!STAGES.includes(notif.previousStage as Stage)) {
      return res.status(400).json({ error: "Stored previous stage is invalid." });
    }

    const app = await Application.findOne({ _id: notif.applicationId, userId: user._id });
    if (!app) return res.status(404).json({ error: "Application not found" });

    app.stage = notif.previousStage as Stage;
    // Drop the most-recent history entry — that was added by the AI auto-update.
    if (app.stageHistory.length > 0) app.stageHistory.pop();
    await app.save();

    notif.resolved = true;
    notif.resolvedAt = new Date();
    notif.read = true;
    notif.readAt = new Date();
    await notif.save();

    res.json({ message: "Stage reverted", notification: notif });
  } catch (err) { next(err); }
});

export default router;
