/** Stricter limiter for auth routes; default API limiter for all `/api` traffic. */
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  // Generous ceiling: one page load fires 5–10 API calls, and users behind a
  // shared IP (campus/office NAT) pool this limit. 100/min was low enough that
  // brisk normal use tripped 429s — which the auth check used to read as
  // "logged out". Abusive traffic is still cut off well below flood level.
  max: 600,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Tight per-IP limit for the BYOK key-validate endpoint. Hits an external
 *  provider on every call → cheap to abuse, expensive to ignore. Keep it well
 *  under what a real user would need (paste / type a few keys per minute). */
export const byokValidateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: { error: "Too many validation attempts. Please wait a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Per-IP limit for the public bug-report endpoint. A genuine client error
 *  burst (e.g. a broken release breaking many UI flows in quick succession)
 *  can fire dozens of events per minute — we let through a window-worth of
 *  signal, then drop. The reporter already dedupes by fingerprint server-side,
 *  so the DB never blows up even if the limiter lets all of these through. */
export const bugReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many reports." },
  standardHeaders: true,
  legacyHeaders: false,
});
