/** Refuses state-changing requests a browser sent from another site.
 *
 *  In production the session cookie is SameSite=None (the app and the API can
 *  sit on different hosts), so a browser attaches it to a form that any page
 *  submits — without this, a forged POST would act as the signed-in admin
 *  (e.g. email every user). The browser tells us where a request came from:
 *  `Sec-Fetch-Site` (the browser's own same-origin judgement, made before any
 *  dev proxy) and `Origin` (sent on every cross-site POST). A request with
 *  neither isn't from a browser page, so it carries no one's cookie by
 *  accident and passes. */
import type { Request, Response, NextFunction } from "express";
import { ALLOWED_ORIGINS } from "../config/origins.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireSameSite(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const site = req.get("sec-fetch-site");
  if (site === "same-origin") return next();

  const origin = req.get("origin");
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin === `${req.protocol}://${req.get("host")}`)) {
    return next();
  }

  if (site || origin) {
    res.status(403).json({ error: "This request came from another site, so it was refused." });
    return;
  }
  next();
}
