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
const PORT = process.env.PORT || 5050;
const isServerless = Boolean(process.env.VERCEL);

// Lazy DB init — safe to call many times. Serverless cold starts will pay
// the first call; subsequent invocations reuse the cached promise.
let dbReady;
export async function ensureDB() {
  if (!dbReady) {
    dbReady = (async () => {
      await connectDB();
      configurePassport();
    })();
  }
  return dbReady;
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// On serverless, every request waits for DB + passport before continuing.
if (isServerless) {
  app.use(async (req, res, next) => {
    try {
      await ensureDB();
      next();
    } catch (err) {
      next(err);
    }
  });
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "hiretrail-dev-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client: client,
      dbName: "HireTrail",
      collectionName: "sessions",
      ttl: 24 * 60 * 60,
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

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/deadlines", deadlineRoutes);
app.use("/api/analytics", analyticsRoutes);

// On local/standalone runs, serve the Vite build. Vercel rewrites static
// assets directly from /frontend/dist via vercel.json.
if (!isServerless) {
  const clientBuildPath = join(__dirname, "..", "frontend", "dist");
  app.use(express.static(clientBuildPath));
  app.get("*", (req, res) => {
    res.sendFile(join(clientBuildPath, "index.html"));
  });

  ensureDB().then(() => {
    app.listen(PORT, () => {
      console.log(`HireTrail server running on port ${PORT}`);
    });
  });
}

export default app;
