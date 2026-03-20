import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { connectDB, client } from "./config/db.js";
import configurePassport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import resumeRoutes from "./routes/resumes.js";
import contactRoutes from "./routes/contacts.js";
import deadlineRoutes from "./routes/deadlines.js";
import analyticsRoutes from "./routes/analytics.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// Session config — stored in MongoDB
app.use(
  session({
    // Security: fallback secret means sessions are forgeable if SESSION_SECRET env var is unset in production; throw an error instead of silently defaulting
    secret: process.env.SESSION_SECRET || "hiretrail-dev-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client: client,
      dbName: "HireTrail",
      collectionName: "sessions",
      ttl: 24 * 60 * 60, // 1 day
    }),
    proxy: process.env.NODE_ENV === "production",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/deadlines", deadlineRoutes);
app.use("/api/analytics", analyticsRoutes);

// Serve React build in production
const clientBuildPath = join(__dirname, "..", "frontend", "dist");
app.use(express.static(clientBuildPath));
// TODO [Bug]: mistyped API paths (e.g. /api/applicaitons) fall through here and receive 200 HTML instead of 404 JSON; add a guard: if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
app.get("*", (_req, res) => {
  res.sendFile(join(clientBuildPath, "index.html"));
});

// Start server after DB connection
async function start() {
  await connectDB();
  configurePassport();

  app.listen(PORT, () => {
    console.log(`HireTrail server running on port ${PORT}`);
  });
}

start();
