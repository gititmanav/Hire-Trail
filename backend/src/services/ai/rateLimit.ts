/**
 * Per-user AI rate limiting (task 4).
 *
 * A lightweight in-process sliding-window limiter applied to EVERY model call
 * (see services/ai/run.ts). It protects providers + our quota from a runaway
 * loop or an abusive client firing hundreds of calls a second. In-process state
 * resets on restart — that's fine, it's a burst guard, not an accounting tool
 * (the durable monthly quota lives in AiUsage). Mirrors the existing in-process
 * concurrency cap pattern in autoAnalyze.ts.
 */
import { AppError } from "../../errors/AppError.js";

const WINDOW_MS = 60_000;
/** Max AI calls per user per window. Generous enough for a bounded-concurrency
 *  Gmail scan + resume chunking, tight enough to stop a runaway. */
const MAX_PER_WINDOW = 40;

const hits = new Map<string, number[]>();

export function assertAiRateLimit(userId: string): void {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(userId, arr);
    throw new AppError("You're sending AI requests too quickly. Please wait a moment and try again.", 429);
  }
  arr.push(now);
  hits.set(userId, arr);
}

// Periodically drop idle users so the map doesn't grow unbounded on a long-lived
// process. Unref so this timer never keeps the process alive.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [user, arr] of hits) {
    const live = arr.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) hits.delete(user);
    else hits.set(user, live);
  }
}, WINDOW_MS);
sweep.unref?.();
