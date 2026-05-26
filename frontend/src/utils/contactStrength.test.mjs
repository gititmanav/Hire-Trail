// Co-located node:test for contactStrength.ts. Mirrors the source-of-truth
// logic — runs without a TS toolchain.
import test from "node:test";
import assert from "node:assert/strict";

const DAY_MS = 86_400_000;

function recencyPoints(lastContactDate, now) {
  if (!lastContactDate) return 0;
  const days = Math.max(0, (now.getTime() - new Date(lastContactDate).getTime()) / DAY_MS);
  if (days >= 180) return 0;
  return Math.round(40 * (1 - days / 180));
}

function outreachPoints(status) {
  switch (status) {
    case "responded":
    case "meeting_scheduled": return 30;
    case "reached_out":       return 10;
    case "follow_up_needed":  return 5;
    case "gone_cold":         return -10;
    default:                  return 0;
  }
}

function contactStrength(c, now = new Date()) {
  const recency = recencyPoints(c.lastContactDate, now);
  const outreach = outreachPoints(c.outreachStatus);
  const linkedin = c.linkedinUrl ? 10 : 0;
  const introductions = Math.min((c.applicationIds?.length ?? 0) * 5, 20);
  const raw = recency + outreach + linkedin + introductions;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tier = score >= 70 ? "strong" : score >= 40 ? "warm" : "weak";
  return { score, tier, factors: { recency, outreach, linkedin, introductions } };
}

const NOW = new Date(2026, 4, 25, 12, 0, 0);
const makeContact = (overrides) => ({
  _id: "x", userId: "u", name: "Alex", company: "Co", companyId: null, role: "Eng",
  linkedinUrl: "", connectionSource: "", lastContactDate: null,
  notes: "", applicationIds: [], outreachStatus: "not_contacted",
  lastOutreachDate: null, nextFollowUpDate: null,
  createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  ...overrides,
});

test("contactStrength: cold contact with no data → weak, score 0", () => {
  const out = contactStrength(makeContact({}), NOW);
  assert.equal(out.score, 0);
  assert.equal(out.tier, "weak");
});

test("contactStrength: perfectly active contact maxes near 100, tier strong", () => {
  const out = contactStrength(makeContact({
    lastContactDate: new Date(2026, 4, 25).toISOString(),
    outreachStatus: "responded",
    linkedinUrl: "https://linkedin.com/in/alex",
    applicationIds: ["a", "b", "c", "d"],
  }), NOW);
  // recency=40, outreach=30, linkedin=10, intro=20 → 100
  assert.equal(out.score, 100);
  assert.equal(out.tier, "strong");
});

test("contactStrength: gone-cold + LinkedIn only → weak", () => {
  const out = contactStrength(makeContact({
    linkedinUrl: "https://linkedin.com/in/alex",
    outreachStatus: "gone_cold",
  }), NOW);
  // recency=0, outreach=-10, linkedin=10, intro=0 → 0 (clamped)
  assert.equal(out.score, 0);
  assert.equal(out.tier, "weak");
});

test("contactStrength: recency decays linearly over 180 days", () => {
  const out90 = contactStrength(makeContact({
    lastContactDate: new Date(NOW.getTime() - 90 * DAY_MS).toISOString(),
  }), NOW);
  // recency ≈ 20, no other signals → 20, tier weak
  assert.equal(out90.factors.recency, 20);
  assert.equal(out90.tier, "weak");

  const out180 = contactStrength(makeContact({
    lastContactDate: new Date(NOW.getTime() - 180 * DAY_MS).toISOString(),
  }), NOW);
  assert.equal(out180.factors.recency, 0);
});

test("contactStrength: introductions cap at 20", () => {
  const out = contactStrength(makeContact({
    applicationIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
  }), NOW);
  assert.equal(out.factors.introductions, 20);
});

test("contactStrength: warm tier band (40–69)", () => {
  const out = contactStrength(makeContact({
    lastContactDate: new Date(NOW.getTime() - 30 * DAY_MS).toISOString(),
    outreachStatus: "reached_out",
    linkedinUrl: "https://x",
    applicationIds: ["a"],
  }), NOW);
  // recency≈33, outreach=10, linkedin=10, intro=5 → 58 → warm
  assert.equal(out.tier, "warm");
});
