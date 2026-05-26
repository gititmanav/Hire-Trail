// Co-located node:test for companyAggregates.ts. Mirrors the source-of-truth
// logic so the test runs without a TS toolchain (matches the existing pattern
// used by deadlineGroups.test.mjs / stageStats.test.mjs / contactStrength.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";

const STAGE_RANK = { Drafting: 0, Applied: 1, OA: 2, Interview: 3, Offer: 4, Rejected: -1 };
const STAGES = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"];

function peakStageReached(app) {
  const seen = [];
  for (const e of app.stageHistory || []) {
    if (e?.stage && STAGE_RANK[e.stage] >= 0) seen.push(e.stage);
  }
  if (STAGE_RANK[app.stage] >= 0) seen.push(app.stage);
  if (seen.length === 0) return app.stage;
  return seen.reduce((best, s) => (STAGE_RANK[s] > STAGE_RANK[best] ? s : best), seen[0]);
}

function companyTimeline(apps) {
  const byStage = { Drafting: 0, Applied: 0, OA: 0, Interview: 0, Offer: 0, Rejected: 0 };
  const entries = [];
  for (const a of apps) {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    entries.push({ appId: a._id, role: a.role, currentStage: a.stage, peakStage: peakStageReached(a), applicationDate: a.applicationDate });
  }
  entries.sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());
  return { total: apps.length, byStage, entries };
}

function summarizeTimeline(t) {
  if (t.total === 0) return "No applications yet.";
  const parts = [];
  for (const s of STAGES) if (t.byStage[s] > 0) parts.push(`${t.byStage[s]} ${s}`);
  const verb = t.total === 1 ? "Applied once" : `Applied ${t.total} times`;
  return `${verb}: ${parts.join(" · ")}.`;
}

const HOURS_PER_YEAR_FT = 2080;

function parseSalaryNumber(token) {
  const cleaned = token.replace(/[$,\s]/g, "");
  const kMatch = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)k$/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const plain = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (plain) return parseFloat(plain[1]);
  return NaN;
}

function parseSalary(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const isHourly = /\/\s?(?:hour|hr|h)\b/i.test(trimmed);
  const body = trimmed.replace(/\/\s?(?:year|yr|annum|hour|hr|h)\b/gi, "").trim();
  const parts = body.split(/\s*[–—-]\s*/).filter((p) => p.trim().length > 0);
  let lo, hi;
  if (parts.length >= 2) { lo = parseSalaryNumber(parts[0]); hi = parseSalaryNumber(parts[1]); }
  else { const s = parseSalaryNumber(body); lo = s; hi = s; }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo <= 0 && hi <= 0) return null;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  if (isHourly) { lo = Math.round(lo * HOURS_PER_YEAR_FT); hi = Math.round(hi * HOURS_PER_YEAR_FT); }
  return { min: lo, max: hi, unit: isHourly ? "hourly" : "annual" };
}

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

function compensationSummary(apps) {
  const ranges = [];
  for (const a of apps) { const r = parseSalary(a.salary); if (r) ranges.push(r); }
  if (ranges.length === 0) return null;
  const min = ranges.reduce((m, r) => Math.min(m, r.min), Number.POSITIVE_INFINITY);
  const max = ranges.reduce((m, r) => Math.max(m, r.max), Number.NEGATIVE_INFINITY);
  const mids = ranges.map((r) => Math.round((r.min + r.max) / 2));
  return { count: ranges.length, min, max, median: median(mids), hasHourly: ranges.some((r) => r.unit === "hourly") };
}

/* ─── Tests ─────────────────────────────────────────────────────────── */

test("peakStageReached: returns the highest non-Rejected stage from history", () => {
  const app = {
    stage: "Rejected",
    stageHistory: [
      { stage: "Applied", date: "2026-01-01" },
      { stage: "OA", date: "2026-01-10" },
      { stage: "Interview", date: "2026-01-20" },
      { stage: "Rejected", date: "2026-02-01" },
    ],
  };
  assert.equal(peakStageReached(app), "Interview");
});

test("peakStageReached: falls back to current stage when history is empty", () => {
  const app = { stage: "Applied", stageHistory: [] };
  assert.equal(peakStageReached(app), "Applied");
});

test("companyTimeline: tallies by current stage and sorts entries newest-first", () => {
  const apps = [
    { _id: "1", role: "SWE", stage: "Offer", applicationDate: "2026-03-01", stageHistory: [{ stage: "Applied", date: "2026-02-01" }] },
    { _id: "2", role: "PM", stage: "Rejected", applicationDate: "2026-04-01", stageHistory: [{ stage: "Applied", date: "2026-03-01" }, { stage: "Interview", date: "2026-03-15" }] },
    { _id: "3", role: "Eng", stage: "Interview", applicationDate: "2026-02-15", stageHistory: [] },
  ];
  const t = companyTimeline(apps);
  assert.equal(t.total, 3);
  assert.equal(t.byStage.Offer, 1);
  assert.equal(t.byStage.Rejected, 1);
  assert.equal(t.byStage.Interview, 1);
  assert.equal(t.entries[0].appId, "2");
  assert.equal(t.entries[2].appId, "3");
  // Peak for the rejected app should be Interview.
  const rejected = t.entries.find((e) => e.appId === "2");
  assert.equal(rejected.peakStage, "Interview");
});

test("summarizeTimeline: renders ordered sentence and uses 'once' for n=1", () => {
  const single = { total: 1, byStage: { Drafting: 0, Applied: 0, OA: 0, Interview: 1, Offer: 0, Rejected: 0 }, entries: [] };
  assert.equal(summarizeTimeline(single), "Applied once: 1 Interview.");
  const multi = { total: 3, byStage: { Drafting: 0, Applied: 0, OA: 0, Interview: 1, Offer: 1, Rejected: 1 }, entries: [] };
  assert.equal(summarizeTimeline(multi), "Applied 3 times: 1 Interview · 1 Offer · 1 Rejected.");
});

test("parseSalary: handles k-suffix range with en-dash", () => {
  const r = parseSalary("$120k–$150k");
  assert.deepEqual(r, { min: 120000, max: 150000, unit: "annual" });
});

test("parseSalary: handles comma-formatted dollars with hyphen and /year", () => {
  const r = parseSalary("$120,000 - $150,000 / year");
  assert.deepEqual(r, { min: 120000, max: 150000, unit: "annual" });
});

test("parseSalary: hourly range annualises at 2080 hours", () => {
  const r = parseSalary("$30 - $50 / hour");
  assert.deepEqual(r, { min: 62400, max: 104000, unit: "hourly" });
});

test("parseSalary: single point salary populates min === max", () => {
  const r = parseSalary("$140k");
  assert.deepEqual(r, { min: 140000, max: 140000, unit: "annual" });
});

test("parseSalary: returns null on noise / empty", () => {
  assert.equal(parseSalary(""), null);
  assert.equal(parseSalary(undefined), null);
  assert.equal(parseSalary("competitive"), null);
});

test("compensationSummary: aggregates min / max / median midpoint across parseable salaries", () => {
  const apps = [
    { salary: "$120k–$140k" },              // mid 130k
    { salary: "$150k - $170k" },            // mid 160k
    { salary: "$200,000" },                 // mid 200k
    { salary: "competitive" },              // skipped
    { salary: "$60/hr" },                   // 124800 (point), mid 124800
  ];
  const s = compensationSummary(apps);
  assert.equal(s.count, 4);
  assert.equal(s.min, 120000);
  assert.equal(s.max, 200000);
  // midpoints sorted: 124800, 130000, 160000, 200000 → median = (130000 + 160000) / 2 = 145000
  assert.equal(s.median, 145000);
  assert.equal(s.hasHourly, true);
});

test("compensationSummary: returns null when no salaries parse", () => {
  const apps = [{ salary: "competitive" }, { salary: "" }, { salary: undefined }];
  assert.equal(compensationSummary(apps), null);
});
