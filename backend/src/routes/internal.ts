/**
 * Server-to-server endpoints. Not for browsers: every call carries an HMAC
 * signature derived from SESSION_SECRET, and anything unsigned is a 404.
 *
 *   POST /api/internal/ai-jobs/:id/continue — run an AI job's next step in a
 *        fresh invocation (services/ai/jobs.ts continues long work this way).
 */
import { Router, Request, Response } from "express";
import mongoose from "mongoose";

import { continueAiJob, verifyContinueSignature } from "../services/ai/jobs.js";

const router = Router();

router.post("/ai-jobs/:id/continue", (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  const sig = String(req.headers["x-hiretrail-job-signature"] ?? "");
  if (!mongoose.isValidObjectId(id) || !verifyContinueSignature(id, sig)) {
    res.status(404).end();
    return;
  }
  continueAiJob(id);
  res.status(202).json({ ok: true });
});

export default router;
