import type { Application, Stage } from "../types";
import { STAGES } from "./stageStyles.ts";

/** Stage-progression ordinal used for "peak reached" calculations. Rejected
 *  is intentionally excluded — it's a terminal outcome, not a depth marker.
 *  An app that hit Interview before being rejected has peak = Interview. */
const STAGE_RANK: Record<Stage, number> = {
  Drafting:  0,
  Applied:   1,
  OA:        2,
  Interview: 3,
  Offer:     4,
  Rejected:  -1,
};

/** Highest non-Rejected stage this app has ever touched (from stageHistory),
 *  falling back to the current stage if the history is empty or only contains
 *  Rejected. Used to render "Rejected (peak: Interview)" style trails so the
 *  Timeline tells the lifetime story, not just the latest snapshot. */
export function peakStageReached(app: Pick<Application, "stage" | "stageHistory">): Stage {
  const seen: Stage[] = [];
  for (const entry of app.stageHistory || []) {
    if (entry?.stage && STAGE_RANK[entry.stage] >= 0) seen.push(entry.stage);
  }
  if (STAGE_RANK[app.stage] >= 0) seen.push(app.stage);
  if (seen.length === 0) return app.stage;
  return seen.reduce((best, s) => (STAGE_RANK[s] > STAGE_RANK[best] ? s : best), seen[0]);
}

export interface CompanyTimelineEntry {
  appId: string;
  role: string;
  currentStage: Stage;
  peakStage: Stage;
  applicationDate: string;
}

export interface CompanyTimeline {
  total: number;
  byStage: Record<Stage, number>;
  entries: CompanyTimelineEntry[];
}

/** Aggregate lifetime stage history for a company. byStage tallies apps by
 *  their *current* stage (matches the HANDOFF example "1 Rejected · 1
 *  Interview · 1 Offer"). entries carries per-app peak so the UI can show a
 *  more granular per-application trail underneath the summary strip. */
export function companyTimeline(apps: Application[]): CompanyTimeline {
  const byStage: Record<Stage, number> = {
    Drafting: 0, Applied: 0, OA: 0, Interview: 0, Offer: 0, Rejected: 0,
  };
  const entries: CompanyTimelineEntry[] = [];
  for (const a of apps) {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    entries.push({
      appId: a._id,
      role: a.role,
      currentStage: a.stage,
      peakStage: peakStageReached(a),
      applicationDate: a.applicationDate,
    });
  }
  entries.sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());
  return { total: apps.length, byStage, entries };
}

/** One-sentence summary used as the section header. The order matches STAGES
 *  so it always reads consistently across companies. */
export function summarizeTimeline(t: CompanyTimeline): string {
  if (t.total === 0) return "No applications yet.";
  const parts: string[] = [];
  for (const s of STAGES) {
    if (t.byStage[s] > 0) parts.push(`${t.byStage[s]} ${s}`);
  }
  const verb = t.total === 1 ? "Applied once" : `Applied ${t.total} times`;
  return `${verb}: ${parts.join(" · ")}.`;
}

/* ─── Compensation memory ─────────────────────────────────────────────── */

export interface SalaryRange {
  /** Annualised lower bound in whole dollars. */
  min: number;
  /** Annualised upper bound in whole dollars. min === max for point salaries. */
  max: number;
  /** Whether the source string was hourly (annualised at 2080 hrs) or already annual.
   *  Used by the UI when we want to disclaim "estimated annual from hourly". */
  unit: "annual" | "hourly";
}

const HOURS_PER_YEAR_FT = 2080;

/** Pull a numeric value out of a salary token. Handles "120k", "$120K",
 *  "120,000", "150.5" (hourly). Returns NaN on no match. */
function parseSalaryNumber(token: string): number {
  const cleaned = token.replace(/[$,\s]/g, "");
  // "120k" or "120K" → 120000
  const kMatch = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)k$/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const plainMatch = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (plainMatch) return parseFloat(plainMatch[1]);
  return NaN;
}

/** Tolerant parser for the free-text `Application.salary` field. Accepts:
 *    "$120k–$150k", "$120k - $150k", "$120,000 - $150,000",
 *    "120k", "$120k", "$120,000", "120000",
 *    "$30/hr - $50/hr", "$45/hour"
 *  Hourly values are annualised at 2080 hrs. Returns null if no number
 *  could be extracted — that's the signal to skip this app in aggregates. */
export function parseSalary(raw: string | undefined | null): SalaryRange | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isHourly = /\/\s?(?:hour|hr|h)\b/i.test(trimmed);
  // Strip the period suffix so the numeric split is clean.
  const body = trimmed
    .replace(/\/\s?(?:year|yr|annum|hour|hr|h)\b/gi, "")
    .trim();

  // Range form — split on en/em dash or hyphen with surrounding whitespace.
  const rangeParts = body.split(/\s*[–—-]\s*/).filter((p) => p.trim().length > 0);
  let lo: number;
  let hi: number;
  if (rangeParts.length >= 2) {
    lo = parseSalaryNumber(rangeParts[0]);
    hi = parseSalaryNumber(rangeParts[1]);
  } else {
    const single = parseSalaryNumber(body);
    lo = single;
    hi = single;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo <= 0 && hi <= 0) return null;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  if (isHourly) {
    lo = Math.round(lo * HOURS_PER_YEAR_FT);
    hi = Math.round(hi * HOURS_PER_YEAR_FT);
  }
  return { min: lo, max: hi, unit: isHourly ? "hourly" : "annual" };
}

export interface CompensationSummary {
  /** Number of apps that contributed a parseable salary. */
  count: number;
  /** Lowest min across all parsed ranges (annualised dollars). */
  min: number;
  /** Highest max across all parsed ranges (annualised dollars). */
  max: number;
  /** Median of per-app midpoints. */
  median: number;
  /** Whether any source salary was hourly — UI uses this to disclaim
   *  "annualised from hourly". */
  hasHourly: boolean;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Aggregate salaries across linked apps. Returns null when no app has a
 *  parseable salary — UI hides the section entirely in that case. */
export function compensationSummary(apps: Application[]): CompensationSummary | null {
  const ranges: SalaryRange[] = [];
  for (const a of apps) {
    const r = parseSalary(a.salary);
    if (r) ranges.push(r);
  }
  if (ranges.length === 0) return null;
  const min = ranges.reduce((m, r) => Math.min(m, r.min), Number.POSITIVE_INFINITY);
  const max = ranges.reduce((m, r) => Math.max(m, r.max), Number.NEGATIVE_INFINITY);
  const midpoints = ranges.map((r) => Math.round((r.min + r.max) / 2));
  return {
    count: ranges.length,
    min,
    max,
    median: median(midpoints),
    hasHourly: ranges.some((r) => r.unit === "hourly"),
  };
}

/** Human-readable "$120k–$150k" style for a dollar amount. Strips trailing
 *  ".0k" so round numbers look clean. */
export function formatMoneyShort(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m.toFixed(m >= 10 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `$${k.toFixed(k >= 100 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return `$${Math.round(n)}`;
}
