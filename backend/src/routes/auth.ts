/** Session-based auth: register/login/logout, Google OAuth, profile and password updates. */
import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { User } from "../models/User.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validators/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const router = Router();

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

      const user = await User.create({ name, email, password });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          _id: user._id,
          name: user.name,
          email: user.email,
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
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  }
  res.status(401).json({ error: "Not authenticated" });
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
    });
  })(req, res, next);
});

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

    res.json({ _id: updated!._id, name: updated!.name, email: updated!.email });
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
