/**
 * Unified email integration routes — Gmail + Outlook.
 *
 *   /api/email/status                  → combined status for both providers
 *   /api/email/scan                    → scan whichever providers are connected
 *   /api/email/gmail/{connect,scan,disconnect,callback}
 *   /api/email/outlook/{connect,scan,disconnect,callback}
 */
import { Router, Request, Response, NextFunction } from "express";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import * as gmail from "../services/gmailService.js";
import * as outlook from "../services/outlookService.js";

const router = Router();

/* ------------------ OAuth callbacks (no auth — redirect targets) ------------------ */

router.get("/callback", async (req: Request, res: Response) => {
  // Legacy Gmail callback path, kept for installed-app compat.
  return handleGmailCallback(req, res);
});

router.get("/gmail/callback", async (req: Request, res: Response) => {
  return handleGmailCallback(req, res);
});

async function handleGmailCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.redirect(`${env.CLIENT_URL}/profile?gmail=error`);
    await gmail.handleCallback(code, state);
    res.redirect(`${env.CLIENT_URL}/profile?gmail=success`);
  } catch (err) {
    console.error("[Gmail] Callback error:", err);
    res.redirect(`${env.CLIENT_URL}/profile?gmail=error`);
  }
}

router.get("/outlook/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) return res.redirect(`${env.CLIENT_URL}/profile?outlook=error`);
    await outlook.handleCallback(code, state);
    res.redirect(`${env.CLIENT_URL}/profile?outlook=success`);
  } catch (err) {
    console.error("[Outlook] Callback error:", err);
    res.redirect(`${env.CLIENT_URL}/profile?outlook=error`);
  }
});

router.use(ensureAuth);

/* ------------------ Combined status + scan ------------------ */

router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id).select(
      "gmailConnected gmailEmail gmailLastSyncAt outlookConnected outlookEmail outlookLastSyncAt"
    );
    res.json({
      gmail: {
        connected: dbUser?.gmailConnected || false,
        email: dbUser?.gmailEmail || null,
        lastSyncAt: dbUser?.gmailLastSyncAt || null,
      },
      outlook: {
        connected: dbUser?.outlookConnected || false,
        email: dbUser?.outlookEmail || null,
        lastSyncAt: dbUser?.outlookLastSyncAt || null,
        configured: outlook.isOutlookConfigured(),
      },
    });
  } catch (err) { next(err); }
});

router.post("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    const dbUser = await User.findById(user._id);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    let totalApplied = 0;
    let totalScanned = 0;
    const errors: string[] = [];

    if (dbUser.gmailConnected) {
      try {
        const r = await gmail.scanUserInbox(dbUser, { windowDays: 7 });
        totalApplied += r.applied;
        totalScanned += r.scanned;
      } catch (err) {
        const e = err as { message?: string };
        errors.push(`Gmail: ${e.message || "failed"}`);
      }
    }

    if (dbUser.outlookConnected) {
      try {
        const r = await outlook.scanUserInbox(dbUser, { windowDays: 7 });
        totalApplied += r.applied;
        totalScanned += r.scanned;
      } catch (err) {
        const e = err as { message?: string };
        errors.push(`Outlook: ${e.message || "failed"}`);
      }
    }

    if (!dbUser.gmailConnected && !dbUser.outlookConnected) {
      return res.status(400).json({ error: "No mailbox connected" });
    }

    const summary = totalApplied > 0
      ? `Scan complete. ${totalApplied} application${totalApplied === 1 ? "" : "s"} updated.`
      : `Scan complete. No new signals in ${totalScanned} emails.`;

    res.json({ message: summary, applied: totalApplied, scanned: totalScanned, errors });
  } catch (err) { next(err); }
});

/* ------------------ Gmail-specific ------------------ */

router.post("/gmail/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ url: gmail.getAuthUrl(user._id.toString()) });
  } catch (err) { next(err); }
});

// Legacy alias for the existing frontend client.
router.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    res.json({ url: gmail.getAuthUrl(user._id.toString()) });
  } catch (err) { next(err); }
});

router.post("/gmail/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await gmail.disconnectGmail(user._id.toString());
    res.json({ message: "Gmail disconnected" });
  } catch (err) { next(err); }
});

router.post("/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await gmail.disconnectGmail(user._id.toString());
    res.json({ message: "Gmail disconnected" });
  } catch (err) { next(err); }
});

/* ------------------ Outlook-specific ------------------ */

router.post("/outlook/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!outlook.isOutlookConfigured()) {
      return res.status(503).json({ error: "Outlook integration not configured on this server." });
    }
    const user = getUser(req);
    const url = await outlook.getAuthUrl(user._id.toString());
    res.json({ url });
  } catch (err) { next(err); }
});

router.post("/outlook/disconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    await outlook.disconnectOutlook(user._id.toString());
    res.json({ message: "Outlook disconnected" });
  } catch (err) { next(err); }
});

export default router;
