/**
 * Express app: Helmet, JSON body, Mongo-backed sessions, Passport, rate-limited /api, SPA static in deploy.
 */
// Sentry must initialize before any other module imports, so its
// instrumentation hooks see the rest of the app come up.
import { initSentry, Sentry } from "./config/sentry.js";
initSentry();

import express from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, extname, join } from "path";

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { configurePassport } from "./config/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { rejectMaintenanceForNonBypass } from "./middleware/maintenanceMode.js";

import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import resumeRoutes from "./routes/resumes.js";
import masterProfileRoutes from "./routes/masterProfile.js";
import aiRoutes from "./routes/ai.js";
import tailorRoutes from "./routes/tailor.js";
import feedbackRoutes from "./routes/feedback.js";
import contactRoutes from "./routes/contacts.js";
import deadlineRoutes from "./routes/deadlines.js";
import analyticsRoutes from "./routes/analytics.js";
import jobRoutes from "./routes/jobs.js";
import companyRoutes from "./routes/companies.js";
import settingsRoutes from "./routes/settings.js";
import proxyRoutes from "./routes/proxy.js";
import adminRoutes from "./routes/admin.js";
import emailRoutes from "./routes/email.js";
import notificationRoutes from "./routes/notifications.js";
import bugRoutes from "./routes/bugs.js";
import { startEmailScanJob } from "./services/emailScanJob.js";
import { reapStalledScanJobs } from "./services/email/firstScan.js";
import { backfillResumeVersions } from "./services/migrations/backfillResumeVersions.js";
import { seedClipboardNudgeForAll } from "./services/migrations/seedClipboardNudge.js";
import { seedAiSettings, migrateAiProviderConfigs } from "./services/migrations/aiPlatform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const ALLOWED_ORIGINS = [
  env.CLIENT_URL,
  "https://hiretrail.manavkaneria.me",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);
      // Allow known web app origins
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // Allow Chrome extensions
      if (origin.startsWith("chrome-extension://")) return callback(null, true);
      // Reject others silently (don't throw — that causes 500s)
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://accounts.google.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: env.NODE_ENV === "production",
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      dbName: "HireTrail",
      collectionName: "sessions",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      // Cross-origin SPA (e.g. Vercel → API host) requires None + Secure for session cookies on fetch.
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api", apiLimiter);
app.use("/api", rejectMaintenanceForNonBypass);

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/master-profile", masterProfileRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/tailor", tailorRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/deadlines", deadlineRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bugs", bugRoutes);

// Monorepo deploy: Vite build at ../frontend/dist (dev UX uses Vite on :5173 with proxy to this API).
const clientBuildPath = join(__dirname, "..", "..", "frontend", "dist");

// Hashed assets (JS/CSS/images) — cache immutably (Vite adds content hashes to filenames).
app.use(
  express.static(clientBuildPath, {
    maxAge: "1y",
    immutable: true,
    index: false, // don't auto-serve index.html from static middleware
  })
);

// SPA fallback — serve index only for app routes (not hashed assets/files).
app.get("*", (req, res) => {
  // If a request looks like a file path (e.g. /assets/index-abc123.css), don't
  // return index.html. This prevents MIME errors on stale asset URLs after deploy.
  if (extname(req.path)) {
    return res.status(404).end();
  }

  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(join(clientBuildPath, "index.html"));
});

// Sentry's Express error handler runs before our own. It captures unhandled
// errors (4xx are filtered by default) and re-throws so our errorHandler still
// formats the JSON response the client expects.
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDB();
  configurePassport();
  // Start email scan cron job only if encryption key is configured
  if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY !== "0000000000000000000000000000000000000000000000000000000000000000") {
    startEmailScanJob();
  }
  // Rescue any first-scan jobs that were mid-flight when the server stopped.
  // Marks them failed with a retryable error so the user can kick a new scan.
  reapStalledScanJobs().catch((err) => console.error("[firstScan] reaper failed:", err));

  // One-time backfill of resume version timelines so the "edit history" strip
  // renders on historical resumes. Idempotent — only writes when versions=[].
  backfillResumeVersions()
    .then(({ updated }) => {
      if (updated > 0) console.log(`[migrate] backfilled versions on ${updated} resume(s)`);
    })
    .catch((err) => console.error("[migrate] resume versions backfill failed:", err));

  // One-time discovery notification so existing users learn the extension can
  // copy a JD to the clipboard. Idempotent — guarded by clipboardNudgeSeeded.
  seedClipboardNudgeForAll()
    .then(({ created }) => {
      if (created > 0) console.log(`[migrate] seeded clipboard nudge for ${created} user(s)`);
    })
    .catch((err) => console.error("[migrate] clipboard nudge seed failed:", err));

  // AI platform: seed the new ai_* settings + collapse to one active key/user.
  seedAiSettings()
    .then(({ created }) => {
      if (created > 0) console.log(`[migrate] seeded ${created} AI setting(s)`);
    })
    .catch((err) => console.error("[migrate] AI settings seed failed:", err));
  migrateAiProviderConfigs()
    .then(({ last4Filled, deactivated }) => {
      if (last4Filled > 0 || deactivated > 0)
        console.log(`[migrate] AI keys: filled ${last4Filled} last4, deactivated ${deactivated} duplicate-active`);
    })
    .catch((err) => console.error("[migrate] AI provider config migration failed:", err));

  app.listen(env.PORT, () => {
    console.log(`HireTrail server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start();
