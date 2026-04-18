/** Session-based auth: register/login/logout, Google OAuth, profile and password updates, token auth for extensions. */
import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validators/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { isAdminEmail } from "../utils/admin.js";
import { AdminLoginEvent } from "../models/AdminLoginEvent.js";
import { ensureAuth, getUser } from "../middleware/auth.js";
import { Resume } from "../models/Resume.js";
import {
  getMaintenanceMode,
  isMaintenanceBypassEmail,
  MAINTENANCE_AUTH_MESSAGE,
} from "../services/maintenance.js";

const router = Router();

function getRequestMeta(req: Request): { ipAddress: string; userAgent: string } {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];
  const ipAddress = (forwardedIp || req.ip || "").trim();
  const userAgent = (req.get("user-agent") || "").slice(0, 512);
  return { ipAddress, userAgent };
}

// Register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (await getMaintenanceMode()) {
        throw new AppError("Registration is disabled during scheduled maintenance.", 503);
      }

      const { name, email, password } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new AppError("Email already registered", 409);
      }

      const user = await User.create({
        name,
        email,
        password,
        role: isAdminEmail(email) ? "admin" : "user",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const meta = getRequestMeta(req);
        void AdminLoginEvent.create({
          userId: user._id,
          email: user.email,
          name: user.name,
          provider: "local",
          ...meta,
        });
        res.status(201).json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// Login
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "local",
      (err: Error | null, user: any, info: { message?: string }) => {
        if (err) return next(err);
        if (!user) {
          if (info?.message === MAINTENANCE_AUTH_MESSAGE) {
            return res.status(503).json({ error: info.message, code: "MAINTENANCE" });
          }
          return res.status(401).json({ error: info?.message || "Invalid credentials" });
        }
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          });
          const meta = getRequestMeta(req);
          void AdminLoginEvent.create({
            userId: user._id,
            email: user.email,
            name: user.name,
            provider: "local",
            ...meta,
          });
        });
      }
    )(req, res, next);
  }
);

// Logout
router.post("/logout", (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
});

// Current user (session cookie or Bearer token — extension uses JWT)
router.get("/me", ensureAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (isAdminEmail(user.email) && user.role !== "admin") {
      await User.findByIdAndUpdate(user._id, { $set: { role: "admin" } });
    }
    const doc = await User.findById(user._id).lean();
    if (!doc) throw new AppError("Not found", 404);
    res.json({
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      tourCompleted: doc.tourCompleted ?? false,
      primaryResumeId: doc.primaryResumeId ? String(doc.primaryResumeId) : null,
    });
  } catch (err) {
    next(err);
  }
});

// Mark guided tour as completed
router.put("/tour", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      throw new AppError("Not authenticated", 401);
    }
    const user = req.user as any;
    await User.findByIdAndUpdate(user._id, { $set: { tourCompleted: true } });
    res.json({ tourCompleted: true });
  } catch (err) {
    next(err);
  }
});

// Google OAuth: redirect to Google (callback URL comes from env.GOOGLE_CALLBACK_URL in passport config)
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth: callback after consent
router.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", (err: Error | null, user: any, info?: { message?: string }) => {
    if (err) {
      console.error("Google OAuth error:", err);
      return res.redirect(`${env.CLIENT_URL}/login`);
    }
    if (!user) {
      if (info?.message === MAINTENANCE_AUTH_MESSAGE) {
        return res.redirect(`${env.CLIENT_URL}/login?maintenance=1`);
      }
      console.error("Google OAuth: no user");
      return res.redirect(`${env.CLIENT_URL}/login`);
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error("Google login error:", loginErr);
        return res.redirect(`${env.CLIENT_URL}/login`);
      }
      res.redirect(env.CLIENT_URL);
      const meta = getRequestMeta(req);
      void AdminLoginEvent.create({
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "google",
        ...meta,
      });
    });
  })(req, res, next);
});

// Token-based login (for Chrome extension)
router.post(
  "/token",
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (user.suspended) {
        return res.status(403).json({ error: "Account suspended" });
      }
      if ((await getMaintenanceMode()) && !isMaintenanceBypassEmail(user.email)) {
        return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
      }
      const token = jwt.sign({ userId: user._id.toString() }, env.SESSION_SECRET, { expiresIn: "30d" });
      res.json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          primaryResumeId: user.primaryResumeId ? String(user.primaryResumeId) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Exchange existing web-app session cookie for a JWT (auto-login for extension)
// The extension reads the connect.sid cookie via chrome.cookies API and sends its value
// in the X-Session-Cookie header (cross-origin fetch can't attach cookies automatically).
router.post(
  "/extension-token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try standard session auth first (in case credentials: include works)
      if (req.isAuthenticated() && req.user) {
        const user = req.user as any;
        const doc = await User.findById(user._id).lean();
        if (!doc) throw new AppError("Not found", 404);
        if (doc.suspended) return res.status(403).json({ error: "Account suspended" });
        if ((await getMaintenanceMode()) && !isMaintenanceBypassEmail(doc.email)) {
          return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
        }

        const token = jwt.sign({ userId: doc._id.toString() }, env.SESSION_SECRET, { expiresIn: "30d" });
        return res.json({
          token,
          user: { _id: doc._id, name: doc.name, email: doc.email, role: doc.role, primaryResumeId: doc.primaryResumeId ? String(doc.primaryResumeId) : null },
        });
      }

      // Fall back to manual session lookup from X-Session-Cookie header
      const rawCookie = req.headers["x-session-cookie"] as string | undefined;
      if (!rawCookie) throw new AppError("Not authenticated", 401);

      // connect.sid value is URL-encoded: s%3A<sessionId>.<signature>
      // Decoded: s:<sessionId>.<signature>
      const decoded = decodeURIComponent(rawCookie);
      const match = decoded.match(/^s:([^.]+)\./);
      if (!match) throw new AppError("Invalid session cookie", 401);

      const sessionId = match[1];

      // Look up session in MongoDB
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;
      if (!db) throw new AppError("Database not connected", 500);
      const sessionDoc = await db.collection("sessions").findOne({ _id: sessionId as any });
      if (!sessionDoc) throw new AppError("Session expired", 401);

      // Parse session data — stored as JSON string in the "session" field
      const sessionData = typeof sessionDoc.session === "string"
        ? JSON.parse(sessionDoc.session)
        : sessionDoc.session;

      const userId = sessionData?.passport?.user;
      if (!userId) throw new AppError("Invalid session", 401);

      const doc = await User.findById(userId).lean();
      if (!doc) throw new AppError("User not found", 404);
      if (doc.suspended) return res.status(403).json({ error: "Account suspended" });
      if ((await getMaintenanceMode()) && !isMaintenanceBypassEmail(doc.email)) {
        return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
      }

      const token = jwt.sign({ userId: doc._id.toString() }, env.SESSION_SECRET, { expiresIn: "30d" });
      res.json({
        token,
        user: { _id: doc._id, name: doc.name, email: doc.email, role: doc.role, primaryResumeId: doc.primaryResumeId ? String(doc.primaryResumeId) : null },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Google sign-in for Chrome extension: accepts a Google OAuth access token, verifies it, returns JWT
router.post(
  "/google/extension",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) throw new AppError("accessToken is required", 400);

      // Verify the access token by fetching user info from Google
      const googleRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!googleRes.ok) throw new AppError("Invalid Google token", 401);

      const profile = (await googleRes.json()) as {
        id: string;
        name: string;
        email: string;
        picture?: string;
      };

      if (!profile.email) throw new AppError("Google account has no email", 400);

      const maintenance = await getMaintenanceMode();
      const emailLower = profile.email.toLowerCase();

      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        if (maintenance && !isMaintenanceBypassEmail(user.email)) {
          return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
        }
      } else {
        user = await User.findOne({ email: emailLower });
        if (user) {
          if (maintenance && !isMaintenanceBypassEmail(user.email)) {
            return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
          }
          user.googleId = profile.id;
          if (isAdminEmail(user.email)) user.role = "admin";
          await user.save();
        } else {
          if (maintenance && !isMaintenanceBypassEmail(emailLower)) {
            return res.status(503).json({ error: MAINTENANCE_AUTH_MESSAGE, code: "MAINTENANCE" });
          }
          user = await User.create({
            name: profile.name,
            email: emailLower,
            googleId: profile.id,
            password: null,
            role: isAdminEmail(profile.email) ? "admin" : "user",
          });
        }
      }

      if (user.suspended) return res.status(403).json({ error: "Account suspended" });

      const token = jwt.sign({ userId: user._id.toString() }, env.SESSION_SECRET, { expiresIn: "30d" });
      res.json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          primaryResumeId: user.primaryResumeId ? String(user.primaryResumeId) : null,
        },
      });

      const meta = getRequestMeta(req);
      void AdminLoginEvent.create({
        userId: user._id,
        email: user.email,
        name: user.name,
        provider: "google-extension",
        ...meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT update profile (session or Bearer)
router.put("/profile", ensureAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, primaryResumeId } = req.body;
    const user = getUser(req);

    if (email && email !== user.email) {
      const existing = await User.findOne({ email: String(email).toLowerCase(), _id: { $ne: user._id } });
      if (existing) throw new AppError("Email already in use", 409);
    }

    const $set: Record<string, unknown> = {
      name: name !== undefined ? String(name).trim() || user.name : user.name,
      email: email !== undefined ? String(email).toLowerCase().trim() : user.email,
    };

    if (primaryResumeId !== undefined) {
      if (primaryResumeId === null || primaryResumeId === "") {
        $set.primaryResumeId = null;
      } else {
        const resume = await Resume.findOne({ _id: primaryResumeId, userId: user._id });
        if (!resume) throw new AppError("Resume not found", 404);
        $set.primaryResumeId = resume._id;
      }
    }

    const updated = await User.findByIdAndUpdate(user._id, { $set }, { new: true, runValidators: true }).lean();
    if (!updated) throw new AppError("Not found", 404);

    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      tourCompleted: updated.tourCompleted ?? false,
      primaryResumeId: updated.primaryResumeId ? String(updated.primaryResumeId) : null,
    });
  } catch (err) {
    next(err);
  }
});

// PUT change password
router.put("/password", ensureAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError("Both current and new password are required", 400);
    }
    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 400);
    }

    const user = await User.findById(getUser(req)._id);
    if (!user || !user.password) {
      throw new AppError("Cannot change password for Google-only accounts", 400);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError("Current password is incorrect", 401);
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
