/**
 * Pure stage-flow analytics used by the Kanban column headers (WIP stats)
 * and by Phase-2 smart suggestions (stuck-in-stage detection).
 *
 * Two metrics:
 *   - `dwellAverages(apps)`     — for each stage, average days an application
 *                                 spends in that stage before transitioning to
 *                                 the next one. Uses CLOSED transitions only;
 *                                 apps currently sitting in a stage don't
 *                                 contribute (otherwise stuck items would
 *                                 inflate the "typical" dwell time).
 *   - `currentStageDwell(app)`  — days the app has spent in its current stage,
 *                                 measured from the latest stageHistory entry.
 *
 * Both are co-located here so the Kanban view, the Smart-Suggestions card,
 * and any future "stage-flow" widget share one source of truth.
 */
import type { Application, Stage } from "../types";

const DAY_MS = 86_400_000;

export interface StageDwell {
  /** Average days, rounded; null when there's no closed-transition sample. */
  avgDays: number | null;
  /** Number of closed transitions that contributed to the average. */
  sampleSize: number;
}

const EMPTY_RECORD: Record<Stage, StageDwell> = {
  Drafting: { avgDays: null, sampleSize: 0 },
  Applied:  { avgDays: null, sampleSize: 0 },
  OA:       { avgDays: null, sampleSize: 0 },
  Interview:{ avgDays: null, sampleSize: 0 },
  Offer:    { avgDays: null, sampleSize: 0 },
  Rejected: { avgDays: null, sampleSize: 0 },
};

/** Average closed-transition dwell time per stage. An "in-progress" app
 *  sitting in stage X right now does NOT contribute — only its prior
 *  transitions (e.g. Applied → OA) do. */
export function dwellAverages(apps: Application[]): Record<Stage, StageDwell> {
  const totals: Record<Stage, { sum: number; count: number }> = {
    Drafting: { sum: 0, count: 0 },
    Applied:  { sum: 0, count: 0 },
    OA:       { sum: 0, count: 0 },
    Interview:{ sum: 0, count: 0 },
    Offer:    { sum: 0, count: 0 },
    Rejected: { sum: 0, count: 0 },
  };

  for (const app of apps) {
    const hist = app.stageHistory;
    if (!Array.isArray(hist) || hist.length < 2) continue;
    for (let i = 0; i < hist.length - 1; i += 1) {
      const stage = hist[i].stage as Stage;
      if (!(stage in totals)) continue;
      const start = new Date(hist[i].date).getTime();
      const end = new Date(hist[i + 1].date).getTime();
      const days = (end - start) / DAY_MS;
      // Guard against bad timestamps (manual edits, CSV imports with
      // out-of-order dates) — negative dwell is never real.
      if (!Number.isFinite(days) || days < 0) continue;
      totals[stage].sum += days;
      totals[stage].count += 1;
    }
  }

  const out = { ...EMPTY_RECORD };
  (Object.keys(totals) as Stage[]).forEach((s) => {
    const t = totals[s];
    out[s] = {
      avgDays: t.count > 0 ? Math.round(t.sum / t.count) : null,
      sampleSize: t.count,
    };
  });
  return out;
}

/** Days the app has spent in its current stage. Uses the latest stageHistory
 *  entry, falling back to applicationDate when history is empty. */
export function currentStageDwell(app: Application, now: Date = new Date()): number {
  const hist = app.stageHistory;
  const ref = Array.isArray(hist) && hist.length > 0
    ? new Date(hist[hist.length - 1].date).getTime()
    : new Date(app.applicationDate).getTime();
  const days = Math.floor((now.getTime() - ref) / DAY_MS);
  return Math.max(0, days);
}
