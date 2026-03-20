import { Router } from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import { getDB } from "../config/db.js";

const router = Router();

// Register with email + password
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const existing = await db
      .collection("users")
      .findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      googleId: null,
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);
    newUser._id = result.insertedId;

    // Auto-login after registration
    req.login(newUser, (err) => {
      if (err) {
        return res.status(500).json({ error: "Login after register failed" });
      }
      return res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      });
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login with email + password
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: "Server error" });
    }
    if (!user) {
      return res.status(401).json({ error: info.message });
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: "Login failed" });
      }
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
      });
    });
  })(req, res, next);
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });
});

// Get current authenticated user
router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    });
  }
  return res.status(401).json({ error: "Not authenticated" });
});

// Google OAuth — initiate
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth — callback
// Google OAuth — callback
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", (err, user) => {
    if (err || !user) {
      console.error("Google OAuth error:", err);
      return res.redirect(
        (process.env.CLIENT_URL || "http://localhost:5173") + "/login"
      );
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error("Google login error:", loginErr);
        return res.redirect(
          (process.env.CLIENT_URL || "http://localhost:5173") + "/login"
        );
      }
      return res.redirect(process.env.CLIENT_URL || "http://localhost:5173");
    });
  })(req, res, next);
});

export default router;
