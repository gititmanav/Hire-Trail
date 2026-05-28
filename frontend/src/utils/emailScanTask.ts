/**
 * Wires the server-side first-scan job into the client's background-tasks
 * system. Both the consent modal (first-time start) and the recovery handler
 * (refresh mid-scan) build the same StartTaskInput via `buildEmailScanTask`
 * so we have a single source of truth for the polling loop and progress curve.
 */
import { emailAPI } from "./api.ts";
import type { ScanJob } from "./api.ts";
import type { Ctx as BackgroundTasksCtx, StartTaskInput } from "../hooks/useBackgroundTasks.tsx";

/** How often we poll the scan job. Cheap endpoint, but no point hammering it. */
const POLL_INTERVAL_MS = 2_000;
/** Maximum total time we'll poll before giving up — keeps a wedged job from
 *  pinning the bar forever. The server-side reaper marks abandoned jobs failed
 *  independently. */
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const TERMINAL_STATUSES = new Set<ScanJob["status"]>(["ready_for_review", "completed", "failed"]);

/** Status → coarse progress floor. Phases with countable sub-progress
 *  (scanning, classifying) layer on top inside `progressFor`. */
const STATUS_BASE_PROGRESS: Record<ScanJob["status"], number> = {
  pending: 0.05,
  scanning: 0.15,
  filtering: 0.5,
  classifying: 0.6,
  ready_for_review: 1,
  completed: 1,
  failed: 1,
};

function progressFor(job: ScanJob): number {
  const base = STATUS_BASE_PROGRESS[job.status] ?? 0;
  if (job.status === "scanning") {
    // Gmail returns up to 250 ids per page for our query; ramp 0.15 → 0.45 as
    // messages are fetched. The exact denominator doesn't matter — the bar
    // just needs to keep moving so the user knows we're alive.
    const fetched = job.progress?.fetched ?? 0;
    const target = Math.max(50, fetched + 25);
    return base + 0.3 * Math.min(1, fetched / target);
  }
  if (job.status === "classifying") {
    const total = job.progress?.threadGroups ?? 0;
    const done = job.progress?.classified ?? 0;
    if (total > 0) return base + 0.35 * Math.min(1, done / total); // 0.6 → 0.95
    return base;
  }
  return base;
}

interface BuildParams {
  jobId: string;
  /** Subtitle copy on the task card — usually "Last N days" for the user's window. */
  sublabel?: string;
}

/** Pure factory — returns a StartTaskInput the caller passes to startTask. */
export function buildEmailScanTask({ jobId, sublabel }: BuildParams): StartTaskInput<ScanJob> {
  return {
    kind: "email_scan",
    label: "Scanning your inbox",
    sublabel,
    recovery: { resourceId: jobId },
    run: async ({ setProgress, setRecovery }) => {
      setRecovery({ resourceId: jobId });
      setProgress(0.05);
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const { job } = await emailAPI.getLatestScanJob();
        // We track "the user's current scan." The server enforces a single
        // active job, so the latest IS the one we registered — an id check
        // would just add a race window (user starts a new scan from another
        // tab in the middle of this one).
        if (!job) throw new Error("Scan job not found — it may have been cleared.");
        setProgress(progressFor(job));
        if (TERMINAL_STATUSES.has(job.status)) {
          if (job.status === "failed") throw new Error(job.error || "Scan failed.");
          return job;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error("Scan timed out. Check the review queue or try again from Settings → Email.");
    },
    onResult: (job) => ({
      successLabel:
        job.counts.totalCandidates > 0
          ? `Scan ready — ${job.counts.totalCandidates} application${job.counts.totalCandidates === 1 ? "" : "s"} to review`
          : "Scan ready — no new applications found",
      ctaLabel: job.counts.totalCandidates > 0 ? "Review" : undefined,
      ctaPath: job.counts.totalCandidates > 0 ? "/settings/email-review" : undefined,
    }),
    onError: (err) => (err instanceof Error && err.message ? err.message : "Scan failed."),
  };
}

/** Convenience: build + start in one call. Returns the task id. */
export function startEmailScanTask(params: BuildParams & { startTask: BackgroundTasksCtx["startTask"] }): string {
  const { startTask, ...rest } = params;
  return startTask(buildEmailScanTask(rest));
}
