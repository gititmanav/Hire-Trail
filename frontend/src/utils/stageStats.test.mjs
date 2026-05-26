// Co-located node:test smoke tests for stageStats.ts.
// Follows the same pattern as applicationHealth.test.mjs — duplicates the
// pure logic here so we can run `node --test` without a TS toolchain. Treat
// the source file as canonical; this is a spec sketch + regression guard.
import test from "node:test";
import assert from "node:assert/strict";

const DAY_MS = 86_400_000;

function dwellAverages(apps) {
  const totals = {
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
      const stage = hist[i].stage;
      if (!(stage in totals)) continue;
      const start = new Date(hist[i].date).getTime();
      const end = new Date(hist[i + 1].date).getTime();
      const days = (end - start) / DAY_MS;
      if (!Number.isFinite(days) || days < 0) continue;
      totals[stage].sum += days;
      totals[stage].count += 1;
    }
  }
  const out = {};
  for (const s of Object.keys(totals)) {
    const t = totals[s];
    out[s] = { avgDays: t.count > 0 ? Math.round(t.sum / t.count) : null, sampleSize: t.count };
  }
  return out;
}

function currentStageDwell(app, now) {
  const hist = app.stageHistory;
  const ref = Array.isArray(hist) && hist.length > 0
    ? new Date(hist[hist.length - 1].date).getTime()
    : new Date(app.applicationDate).getTime();
  const days = Math.floor((now.getTime() - ref) / DAY_MS);
  return Math.max(0, days);
}

const makeApp = (overrides) => ({
  applicationDate: "2026-01-01T00:00:00.000Z",
  stage: "Applied",
  stageHistory: [],
  ...overrides,
});

test("dwellAverages: empty input → all stages null", () => {
  const out = dwellAverages([]);
  assert.equal(out.Applied.avgDays, null);
  assert.equal(out.OA.sampleSize, 0);
});

test("dwellAverages: single closed transition contributes one sample to source stage", () => {
  const app = makeApp({
    stage: "OA",
    stageHistory: [
      { stage: "Applied", date: "2026-01-01T00:00:00.000Z" },
      { stage: "OA",      date: "2026-01-06T00:00:00.000Z" },
    ],
  });
  const out = dwellAverages([app]);
  assert.equal(out.Applied.avgDays, 5);
  assert.equal(out.Applied.sampleSize, 1);
  assert.equal(out.OA.avgDays, null, "terminal stage gets no sample");
});

test("dwellAverages: averages across apps + stages", () => {
  const a = makeApp({
    stage: "Interview",
    stageHistory: [
      { stage: "Applied",   date: "2026-01-01T00:00:00.000Z" },
      { stage: "OA",        date: "2026-01-04T00:00:00.000Z" }, // Applied: 3d
      { stage: "Interview", date: "2026-01-14T00:00:00.000Z" }, // OA: 10d
    ],
  });
  const b = makeApp({
    stage: "Interview",
    stageHistory: [
      { stage: "Applied",   date: "2026-02-01T00:00:00.000Z" },
      { stage: "OA",        date: "2026-02-08T00:00:00.000Z" }, // Applied: 7d
      { stage: "Interview", date: "2026-02-12T00:00:00.000Z" }, // OA: 4d
    ],
  });
  const out = dwellAverages([a, b]);
  assert.equal(out.Applied.avgDays, 5, "(3+7)/2 = 5");
  assert.equal(out.OA.avgDays, 7, "(10+4)/2 = 7");
  assert.equal(out.Interview.sampleSize, 0, "terminal in both → no sample");
});

test("dwellAverages: skips negative transitions (bad CSV ordering)", () => {
  const app = makeApp({
    stageHistory: [
      { stage: "Applied", date: "2026-01-10T00:00:00.000Z" },
      { stage: "OA",      date: "2026-01-05T00:00:00.000Z" },
    ],
  });
  const out = dwellAverages([app]);
  assert.equal(out.Applied.sampleSize, 0);
});

test("currentStageDwell: days since latest stage entry", () => {
  const app = makeApp({
    stage: "OA",
    stageHistory: [
      { stage: "Applied", date: "2026-01-01T00:00:00.000Z" },
      { stage: "OA",      date: "2026-01-08T00:00:00.000Z" },
    ],
  });
  assert.equal(currentStageDwell(app, new Date("2026-01-18T12:00:00.000Z")), 10);
});

test("currentStageDwell: falls back to applicationDate when history empty", () => {
  const app = makeApp({ applicationDate: "2026-02-01T00:00:00.000Z" });
  assert.equal(currentStageDwell(app, new Date("2026-02-04T00:00:00.000Z")), 3);
});
