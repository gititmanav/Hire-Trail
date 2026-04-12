import { Router, Request, Response, NextFunction } from "express";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { getAuthUrl, handleCallback, scanUserInbox, disconnectGmail } from "../services/gmailService.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

const router = Router();

// GET callback — OAuth callback from Google (no auth required, it's a redirect)
router.get("/callback", async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string; // userId
    if (!code || !state) {
      return res.redirect(`${env.CLIENT_URL}/profile?gmail=error`);
    }
    await handleCallback(code, state);
    res.redirect(`${env.CLIENT_URL}/profile?gmail=success`);
  } catch (err) {
    console.error("[Gmail] Callback error:", err);
    res.redirect(`${env.CLIENT_URL}/profile?gmail=error`);
  }
});

// All routes below require auth
router.use(ensureAuth);

// POST connect — returns OAuth URL
router.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const url = getAuthUrl(user._id.toString());
    res.json({ url });
  } catch (err) { next(err); }
});

// GET status
router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id).select("gmailConnected gmailEmail gmailLastSyncAt");
    res.json({
      connected: dbUser?.gmailConnected || false,
      email: dbUser?.gmailEmail || null,
      lastSyncAt: dbUser?.gmailLastSyncAt || null,
    });
  } catch (err) { next(err); }
});

// POST scan — manual scan trigger
router.post("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id);
    if (!dbUser || !dbUser.gmailConnected) {
      return res.status(400).json({ error: "Gmail not connected" });
    }
    const count = await scanUserInbox(dbUser);
    res.json({ message: `Scan complete. ${count} rejection(s) detected.`, count });
  } catch (err) { next(err); }
});

// POST disconnect
router.post("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await disconnectGmail(user._id.toString());
    res.json({ message: "Gmail disconnected" });
  } catch (err) { next(err); }
});

export default router;
