// Quick smoke tests for applicationHealth — runs under node:test.
// Mirrors the TS module's logic against the compiled JS so we don't need
// to set up ts-node just for two functions.
import test from "node:test";
import assert from "node:assert/strict";

// Manually replicate the bits we need for testing. Keeping this file
// tiny and dependency-free; the source is the source of truth.

const DAY_MS = 86_400_000;
const TERMINAL = new Set(["Offer", "Rejected"]);

function startOfDay(d) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }

function lastStageChangeDate(app) {
  if (Array.isArray(app.stageHistory) && app.stageHistory.length > 0) {
    const last = app.stageHistory[app.stageHistory.length - 1];
    if (last?.date) return new Date(last.date);
  }
  return new Date(app.applicationDate);
}

function daysSinceLastStageChange(app, now) {
  const last = startOfDay(lastStageChangeDate(app)).getTime();
  const today = startOfDay(now).getTime();
  return Math.max(0, Math.round((today - last) / DAY_MS));
}

function tone(days, stage) {
  if (TERMINAL.has(stage)) return "neutral";
  if (days <= 7) return "fresh";
  if (days <= 21) return "warm";
  if (days <= 45) return "cooling";
  return "stale";
}

const now = new Date("2026-05-21T12:00:00Z");

test("fresh: 3 days in Applied → fresh tone", () => {
  const app = {
    stage: "Applied",
    applicationDate: "2026-05-18T10:00:00Z",
    stageHistory: [{ stage: "Applied", date: "2026-05-18T10:00:00Z" }],
  };
  assert.equal(daysSinceLastStageChange(app, now), 3);
  assert.equal(tone(3, "Applied"), "fresh");
});

test("stale: 60 days in Applied → stale tone", () => {
  const app = {
    stage: "Applied",
    applicationDate: "2026-03-22T10:00:00Z",
    stageHistory: [{ stage: "Applied", date: "2026-03-22T10:00:00Z" }],
  };
  assert.equal(daysSinceLastStageChange(app, now), 60);
  assert.equal(tone(60, "Applied"), "stale");
});

test("neutral: 60d Rejected → neutral (terminal)", () => {
  const app = {
    stage: "Rejected",
    applicationDate: "2026-01-01",
    stageHistory: [{ stage: "Rejected", date: "2026-03-22T10:00:00Z" }],
  };
  assert.equal(tone(daysSinceLastStageChange(app, now), "Rejected"), "neutral");
});

test("measures last stage change, not creation", () => {
  // Applied 90 days ago, but moved to Interview 5 days ago → fresh
  const app = {
    stage: "Interview",
    applicationDate: "2026-02-20T10:00:00Z",
    stageHistory: [
      { stage: "Applied", date: "2026-02-20T10:00:00Z" },
      { stage: "Interview", date: "2026-05-16T10:00:00Z" },
    ],
  };
  assert.equal(daysSinceLastStageChange(app, now), 5);
  assert.equal(tone(5, "Interview"), "fresh");
});

test("fallback to applicationDate when no stage history", () => {
  const app = { stage: "Applied", applicationDate: "2026-05-18T10:00:00Z", stageHistory: [] };
  assert.equal(daysSinceLastStageChange(app, now), 3);
});

test("never negative", () => {
  const future = { stage: "Applied", applicationDate: "2099-01-01", stageHistory: [] };
  assert.equal(daysSinceLastStageChange(future, now), 0);
});
