// Co-located node:test for deadlineGroups.ts. Mirrors the source-of-truth logic
// here so the test runs without a TS toolchain (matching applicationHealth.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";

const DAY_MS = 86_400_000;
function startOfDay(d) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }

const BUCKET_ORDER = ["overdue", "today", "tomorrow", "thisWeek", "later", "completed"];

function groupDeadlines(deadlines, now) {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS);
  const out = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], completed: [] };
  for (const d of deadlines) {
    if (d.completed) { out.completed.push(d); continue; }
    const due = startOfDay(new Date(d.dueDate));
    if (due.getTime() < today.getTime()) out.overdue.push(d);
    else if (due.getTime() === today.getTime()) out.today.push(d);
    else if (due.getTime() === tomorrow.getTime()) out.tomorrow.push(d);
    else if (due.getTime() < weekEnd.getTime()) out.thisWeek.push(d);
    else out.later.push(d);
  }
  for (const k of BUCKET_ORDER) {
    out[k].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
  return out;
}

// Anchor NOW + due dates to LOCAL noon so day-boundary timezone shifts can't
// move a "today" date into "tomorrow" or vice-versa on the runner's machine.
const NOW = new Date(2026, 4, 25, 12, 0, 0); // May 25, 2026 local noon
const dateAt = (y, m, d) => new Date(y, m, d, 12, 0, 0).toISOString();

function makeDl(overrides) {
  return { _id: "x", userId: "u", applicationId: null, type: "Follow-up reminder", dueDate: dateAt(2026, 4, 25), completed: false, notes: "", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...overrides };
}

test("groupDeadlines: today's bucket matches local date", () => {
  const out = groupDeadlines([makeDl({ dueDate: dateAt(2026, 4, 25) })], NOW);
  assert.equal(out.today.length, 1);
  assert.equal(out.overdue.length, 0);
});

test("groupDeadlines: tomorrow's bucket distinct from today + thisWeek", () => {
  const out = groupDeadlines([
    makeDl({ _id: "a", dueDate: dateAt(2026, 4, 26) }),
    makeDl({ _id: "b", dueDate: dateAt(2026, 4, 28) }),
  ], NOW);
  assert.equal(out.tomorrow.length, 1);
  assert.equal(out.tomorrow[0]._id, "a");
  assert.equal(out.thisWeek.length, 1);
  assert.equal(out.thisWeek[0]._id, "b");
});

test("groupDeadlines: anything past + incomplete is overdue", () => {
  const out = groupDeadlines([makeDl({ dueDate: dateAt(2026, 3, 1) })], NOW);
  assert.equal(out.overdue.length, 1);
});

test("groupDeadlines: completed items skip urgency buckets", () => {
  const out = groupDeadlines([makeDl({ completed: true, dueDate: dateAt(2026, 3, 1) })], NOW);
  assert.equal(out.overdue.length, 0);
  assert.equal(out.completed.length, 1);
});

test("groupDeadlines: later bucket holds beyond-week items", () => {
  const out = groupDeadlines([makeDl({ dueDate: dateAt(2026, 6, 1) })], NOW);
  assert.equal(out.later.length, 1);
});

test("groupDeadlines: each bucket is sorted by dueDate ascending", () => {
  const out = groupDeadlines([
    makeDl({ _id: "1", dueDate: dateAt(2026, 4, 30) }),
    makeDl({ _id: "2", dueDate: dateAt(2026, 4, 27) }),
    makeDl({ _id: "3", dueDate: dateAt(2026, 4, 29) }),
  ], NOW);
  assert.deepEqual(out.thisWeek.map(d => d._id), ["2", "3", "1"]);
});
