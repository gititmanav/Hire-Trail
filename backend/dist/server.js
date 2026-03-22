/**
 * Express app: Helmet, JSON body, Mongo-backed sessions, Passport, rate-limited /api, SPA static in deploy.
 */
import express from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { configurePassport } from "./config/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import resumeRoutes from "./routes/resumes.js";
import contactRoutes from "./routes/contacts.js";
import deadlineRoutes from "./routes/deadlines.js";
import analyticsRoutes from "./routes/analytics.js";
import jobRoutes from "./routes/jobs.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
}));
app.use(helmet({
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
}));
if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
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
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/deadlines", deadlineRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/jobs", jobRoutes);
// Monorepo deploy: Vite build at ../frontend/dist (dev UX uses Vite on :5173 with proxy to this API).
const clientBuildPath = join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(clientBuildPath));
app.get("*", (_req, res) => {
    res.sendFile(join(clientBuildPath, "index.html"));
});
app.use(errorHandler);
async function start() {
    await connectDB();
    configurePassport();
    app.listen(env.PORT, () => {
        console.log(`HireTrail server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
}
start();
//# sourceMappingURL=server.js.map