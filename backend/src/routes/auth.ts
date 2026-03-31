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
      (err: Error | null, user: any, info: { message: string }) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ error: info.message });
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

// Current user
router.get("/me", (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as any;
    if (isAdminEmail(user.email) && user.role !== "admin") {
      void User.findByIdAndUpdate(user._id, { $set: { role: "admin" } }).catch(() => {});
      user.role = "admin";
    }
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tourCompleted: user.tourCompleted ?? false,
    });
  }
  res.status(401).json({ error: "Not authenticated" });
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

// Google OAuth: redirect to Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth: callback after consent
router.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", (err: Error | null, user: any) => {
    if (err || !user) {
      console.error("Google OAuth error:", err);
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
      const token = jwt.sign({ userId: user._id.toString() }, env.SESSION_SECRET, { expiresIn: "30d" });
      res.json({
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

// PUT update profile
router.put("/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      throw new AppError("Not authenticated", 401);
    }
    const { name, email } = req.body;
    const user = req.user as any;

    if (email && email !== user.email) {
      const { User: UserModel } = await import("../models/User.js");
      const existing = await UserModel.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) throw new AppError("Email already in use", 409);
    }

    const { User: UserModel } = await import("../models/User.js");
    const updated = await UserModel.findByIdAndUpdate(
      user._id,
      { $set: { name: name || user.name, email: email ? email.toLowerCase() : user.email } },
      { new: true, runValidators: true }
    );

    res.json({
      _id: updated!._id,
      name: updated!.name,
      email: updated!.email,
      role: updated!.role,
    });
  } catch (err) {
    next(err);
  }
});

// PUT change password
router.put("/password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      throw new AppError("Not authenticated", 401);
    }
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError("Both current and new password are required", 400);
    }
    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 400);
    }

    const { User: UserModel } = await import("../models/User.js");
    const user = await UserModel.findById((req.user as any)._id);
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
