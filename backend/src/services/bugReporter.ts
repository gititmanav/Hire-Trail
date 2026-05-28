/**
 * Single entry point for capturing a bug into the admin panel. Idempotent
 * within the dedup window: identical (fingerprint, status=new|triaged) rows
 * get merged via `$inc: count` instead of duplicated.
 *
 * Failures in the reporter itself are SWALLOWED — a broken reporter must never
 * crash the original error path. Worst case: a bug doesn't show up in the
 * panel, which we already accept for Sentry-only setups.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { BugReport, type BugReportSource } from "../models/BugReport.js";
import { sanitizedPreview } from "../utils/sanitize.js";

export interface ReportBugInput {
  source: BugReportSource;
  errorMessage: string;
  errorStack?: string;
  route?: string;
  method?: string;
  userId?: mongoose.Types.ObjectId | string | null;
  userAgent?: string;
  /** Raw request body — sanitized internally. Pass `req.body` directly. */
  requestBody?: unknown;
}

/** sha256(message + first 3 stack frames), truncated. Groups recurrences of
 *  the same bug; small enough to fit in an index. */
function fingerprint(message: string, stack: string | undefined): string {
  const frames = (stack || "")
    .split("\n")
    .slice(1, 4) // skip the error name line, take the next 3 frames
    .map((s) => s.trim())
    .join("\n");
  const seed = `${message}\n${frames}`;
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

export async function reportBug(input: ReportBugInput): Promise<void> {
  try {
    const fp = fingerprint(input.errorMessage, input.errorStack);
    const userId =
      input.userId && mongoose.Types.ObjectId.isValid(String(input.userId))
        ? new mongoose.Types.ObjectId(String(input.userId))
        : null;
    const now = new Date();

    const requestBodyPreview = input.requestBody !== undefined
      ? sanitizedPreview(input.requestBody)
      : "";

    const update: Record<string, unknown> = {
      $set: {
        source: input.source,
        // Trim everything that could be unbounded so a runaway error message
        // doesn't blow up the document size.
        errorMessage: input.errorMessage.slice(0, 1000),
        errorStack: (input.errorStack || "").slice(0, 4000),
        route: (input.route || "").slice(0, 200),
        method: (input.method || "").slice(0, 16),
        userAgent: (input.userAgent || "").slice(0, 500),
        requestBodyPreview,
        lastSeenAt: now,
      },
      $setOnInsert: {
        fingerprint: fp,
        status: "new",
        firstSeenAt: now,
      },
      $inc: { count: 1 },
    };
    if (userId) {
      update.$addToSet = { affectedUserIds: userId };
    }

    await BugReport.updateOne(
      { fingerprint: fp, status: { $in: ["new", "triaged"] } },
      update,
      { upsert: true },
    );
  } catch (err) {
    // The reporter is allowed to fail silently; log to stderr so it's at least
    // visible in the running process output.
    console.warn("[bugReporter] failed to record bug:", err instanceof Error ? err.message : err);
  }
}
