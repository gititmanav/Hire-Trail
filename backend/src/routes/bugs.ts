/**
 * Public bug-report intake. The frontend POSTs uncaught exceptions and 5xx
 * responses here so they land in the admin panel for triage.
 *
 * Auth is OPTIONAL — we still want to capture errors a logged-out visitor
 * hits on the landing page or auth flow. When a session is present we attach
 * the userId for "affected users" tracking; otherwise the row is anonymous.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { reportBug } from "../services/bugReporter.js";
import { bugReportLimiter } from "../middleware/rateLimiter.js";
import { BUG_REPORT_SOURCES } from "../models/BugReport.js";
import type { IUser } from "../models/User.js";

const router = Router();

const reportSchema = z.object({
  source: z.enum(BUG_REPORT_SOURCES),
  errorMessage: z.string().min(1).max(2000),
  errorStack: z.string().max(8000).optional(),
  route: z.string().max(200).optional(),
  /** Free-form context the client wants to attach. Sanitized server-side
   *  before storage, so passwords/tokens can never leak even if a buggy
   *  caller bundles them in. */
  context: z.unknown().optional(),
});

router.post("/report", bugReportLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      // Bad payload — return 204 anyway. The whole point of this endpoint is
      // "fire and forget"; surfacing a 400 to a broken client just causes a
      // second bug report about a failed bug report.
      res.status(204).end();
      return;
    }
    await reportBug({
      source: parsed.data.source,
      errorMessage: parsed.data.errorMessage,
      errorStack: parsed.data.errorStack,
      route: parsed.data.route,
      userId: (req.user as IUser | undefined)?._id ?? null,
      userAgent: req.get("user-agent"),
      requestBody: parsed.data.context,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
