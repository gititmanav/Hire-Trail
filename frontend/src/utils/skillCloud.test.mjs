// Co-located node:test for skillCloud.ts. Mirrors the source-of-truth logic
// so the test runs without a TS toolchain (matches stageStats.test.mjs etc.).
import test from "node:test";
import assert from "node:assert/strict";

function normalize(t) { return t.trim().toLowerCase(); }

function tallySkills(experiences) {
  const map = new Map();
  experiences.forEach((exp, idx) => {
    for (const b of exp.bullets || []) {
      for (const raw of b.tags || []) {
        const key = normalize(raw);
        if (!key) continue;
        const existing = map.get(key);
        if (existing) { existing.count += 1; existing.expSet.add(idx); }
        else { map.set(key, { display: raw.trim(), count: 1, expSet: new Set([idx]) }); }
      }
    }
  });
  return Array.from(map.values())
    .map((v) => ({ skill: v.display, count: v.count, experienceIndexes: Array.from(v.expSet).sort((a, b) => a - b) }))
    .sort((a, b) => (b.count - a.count) || a.skill.localeCompare(b.skill));
}

function chipSize(count, maxCount) {
  const MIN = 0.75, MAX = 1.25;
  if (maxCount <= 1) return MIN;
  const t = Math.log1p(count - 1) / Math.log1p(maxCount - 1);
  return MIN + (MAX - MIN) * Math.max(0, Math.min(1, t));
}

function experienceUsesSkill(exp, skill) {
  if (!skill) return false;
  const target = normalize(skill);
  return (exp.bullets || []).some((b) => (b.tags || []).some((t) => normalize(t) === target));
}

test("tallySkills: empty input returns empty array", () => {
  assert.deepEqual(tallySkills([]), []);
});

test("tallySkills: tallies frequency across multiple experiences", () => {
  const exps = [
    { company: "A", role: "Dev", bullets: [
      { text: "did things with React and Node", tags: ["React", "Node"] },
      { text: "wrote React tests", tags: ["React", "Jest"] },
    ]},
    { company: "B", role: "Senior", bullets: [
      { text: "built APIs in Node", tags: ["Node", "Postgres"] },
    ]},
  ];
  const out = tallySkills(exps);
  // Sorted desc by count, then alpha. Node + React tie at 2 → Node first alpha.
  assert.equal(out[0].skill, "Node");
  assert.equal(out[0].count, 2);
  assert.deepEqual(out[0].experienceIndexes, [0, 1]);
  assert.equal(out[1].skill, "React");
  assert.equal(out[1].count, 2);
  assert.deepEqual(out[1].experienceIndexes, [0]);
});

test("tallySkills: normalises case but preserves first-seen display", () => {
  const exps = [
    { company: "A", role: "Dev", bullets: [{ text: "x", tags: ["TypeScript", "typescript", "TYPESCRIPT"] }] },
  ];
  const out = tallySkills(exps);
  assert.equal(out.length, 1);
  assert.equal(out[0].skill, "TypeScript");
  assert.equal(out[0].count, 3);
});

test("tallySkills: skips empty / whitespace tags", () => {
  const exps = [
    { company: "A", role: "Dev", bullets: [{ text: "x", tags: ["", "   ", "Go"] }] },
  ];
  const out = tallySkills(exps);
  assert.deepEqual(out.map((s) => s.skill), ["Go"]);
});

test("chipSize: maxCount = 1 returns the floor (no scale possible)", () => {
  assert.equal(chipSize(1, 1), 0.75);
  assert.equal(chipSize(1, 0), 0.75);
});

test("chipSize: scales between 0.75 and 1.25 with log curve", () => {
  // At count = maxCount, we should be at the ceiling.
  assert.equal(chipSize(10, 10), 1.25);
  // At count = 1 (single mention), we're at the floor.
  assert.equal(chipSize(1, 10), 0.75);
  // Midrange must be between min and max.
  const mid = chipSize(5, 10);
  assert.ok(mid > 0.75 && mid < 1.25, `expected mid in (0.75, 1.25), got ${mid}`);
});

test("experienceUsesSkill: case-insensitive match against bullet tags", () => {
  const exp = { company: "A", role: "Dev", bullets: [{ text: "x", tags: ["React", "Node"] }] };
  assert.equal(experienceUsesSkill(exp, "react"), true);
  assert.equal(experienceUsesSkill(exp, "GraphQL"), false);
  assert.equal(experienceUsesSkill(exp, null), false);
});
