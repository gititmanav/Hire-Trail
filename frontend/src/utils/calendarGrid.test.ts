// Calendar layout engine (utils/calendarGrid.ts) — run with dates.test.ts
// under several zones (see the command there).
import test from "node:test";
import assert from "node:assert/strict";
import {
  anchorFor, canDrop, carryAnchor, cellAtPoint, compareEvents, describeDay, groupByDay, isDraggable, monthWeeks,
  overdueDeadlines, projectGhosts, shiftAnchor, slotsFor, splitOverflow, visibleRange, weekDays, type CalendarEvent,
} from "./calendarGrid.ts";
import { addDaysYmd, diffDaysYmd, parseYmd } from "./dates.ts";

const TODAY = "2026-09-26";

function ev(partial: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "kind" | "date">): CalendarEvent {
  return { entityId: partial.id, applicationId: null, title: partial.id, company: "", role: "", ...partial };
}

test("monthWeeks: always 6 × 7, contiguous, holding the whole month — every month 2024–2030, every week start", () => {
  for (let year = 2024; year <= 2030; year++) {
    for (let month = 0; month < 12; month++) {
      for (let ws = 0; ws < 7; ws++) {
        const weeks = monthWeeks(year, month, ws);
        assert.equal(weeks.length, 6);
        const days = weeks.flat();
        assert.equal(days.length, 42);
        assert.equal(parseYmd(days[0])!.getDay(), ws, `${year}-${month + 1} ws=${ws} starts on the week start`);
        for (let i = 1; i < 42; i++) assert.equal(diffDaysYmd(days[i - 1], days[i]), 1, "contiguous days");
        const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const last = addDaysYmd(`${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, "0")}-01`, -1);
        assert.ok(days[0] <= first && days[41] >= last, "whole month on the grid");
        assert.ok(days.indexOf(first) < 7, "the 1st sits in the first row");
      }
    }
  }
});

test("weekDays and visible ranges", () => {
  assert.deepEqual(weekDays("2026-09-20"), ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]);
  assert.deepEqual(visibleRange("month", "2026-09-01", 0), { from: "2026-08-30", to: "2026-10-10" });
  assert.deepEqual(visibleRange("month", "2026-09-01", 1), { from: "2026-08-31", to: "2026-10-11" });
  assert.deepEqual(visibleRange("week", "2026-09-26", 1), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(visibleRange("day", TODAY, 0), { from: TODAY, to: TODAY });
});

test("paging: months land on the 1st, weeks and days step exactly", () => {
  assert.equal(shiftAnchor("month", "2026-01-01", -1), "2025-12-01");
  assert.equal(shiftAnchor("month", "2026-12-01", 1), "2027-01-01");
  assert.equal(shiftAnchor("week", "2026-03-01", 1), "2026-03-08");
  assert.equal(shiftAnchor("day", "2024-02-28", 1), "2024-02-29");
  assert.equal(anchorFor("month", "2026-09-26", 0), "2026-09-01");
  assert.equal(anchorFor("week", "2026-09-26", 1), "2026-09-21");
});

test("scale toggles carry the anchor instead of teleporting", () => {
  // Month → week: the week holding today when today is in that month…
  assert.equal(carryAnchor("month", "week", "2026-09-01", TODAY, 0), "2026-09-20");
  // …else the month's first week.
  assert.equal(carryAnchor("month", "week", "2026-11-01", TODAY, 0), "2026-11-01");
  assert.equal(carryAnchor("month", "week", "2026-11-01", TODAY, 1), "2026-10-26");
  assert.equal(carryAnchor("month", "day", "2026-09-01", TODAY, 0), TODAY);
  assert.equal(carryAnchor("month", "day", "2026-11-01", TODAY, 0), "2026-11-01");
  // Week → month: the month owning the week's middle day (Sun Aug 30 – Sat Sep 5 → September).
  assert.equal(carryAnchor("week", "month", "2026-08-30", TODAY, 0), "2026-09-01");
  // Mon Jul 27 – Sun Aug 2: middle is Thu Jul 30 → July.
  assert.equal(carryAnchor("week", "month", "2026-07-27", TODAY, 1), "2026-07-01");
  // Week → day: today if inside the week, else its first day.
  assert.equal(carryAnchor("week", "day", "2026-09-20", TODAY, 0), TODAY);
  assert.equal(carryAnchor("week", "day", "2026-10-04", TODAY, 0), "2026-10-04");
  // Day → week / month.
  assert.equal(carryAnchor("day", "week", "2026-10-07", TODAY, 1), "2026-10-05");
  assert.equal(carryAnchor("day", "month", "2026-10-07", TODAY, 1), "2026-10-01");
});

test("rank order: overdue → open deadlines → stage entries → applied → ghosts, then company, then id", () => {
  const day = "2026-09-20";
  const list = [
    ev({ id: "ghost", kind: "deadline", date: day, ghost: true, company: "A" }),
    ev({ id: "applied-b", kind: "applied", date: day, company: "Bravo" }),
    ev({ id: "applied-a", kind: "applied", date: day, company: "Alpha" }),
    ev({ id: "stage", kind: "stage", date: day, company: "Zulu" }),
    ev({ id: "dl", kind: "deadline", date: day, company: "Zulu" }),
  ];
  // Before today → the deadline is overdue, still first.
  assert.deepEqual([...list].sort(compareEvents(TODAY)).map((e) => e.id), ["dl", "stage", "applied-a", "applied-b", "ghost"]);
  const grouped = groupByDay([...list, ev({ id: "other", kind: "applied", date: TODAY })], TODAY);
  assert.deepEqual(grouped.get(day)!.map((e) => e.id), ["dl", "stage", "applied-a", "applied-b", "ghost"]);
  assert.equal(grouped.get(TODAY)!.length, 1);
  // An overdue deadline outranks an open one on the same day.
  const mixed = [ev({ id: "open", kind: "deadline", date: TODAY, company: "A" }), ev({ id: "late", kind: "deadline", date: "2026-09-01", company: "Z" })];
  assert.equal([...mixed].sort(compareEvents(TODAY))[0].id, "late");
});

test("overdue list: open deadlines before today, oldest first, no ghosts", () => {
  const list = [
    ev({ id: "b", kind: "deadline", date: "2026-09-20" }),
    ev({ id: "a", kind: "deadline", date: "2026-09-01" }),
    ev({ id: "today", kind: "deadline", date: TODAY }),
    ev({ id: "rec", kind: "applied", date: "2026-09-01" }),
    ev({ id: "g", kind: "deadline", date: "2026-09-02", ghost: true }),
  ];
  assert.deepEqual(overdueDeadlines(list, TODAY).map((e) => e.id), ["a", "b"]);
});

test("measured overflow: the last visible slot becomes 'N more'", () => {
  assert.equal(slotsFor(26 + 4 + 22 * 4), 4);
  assert.equal(slotsFor(26 + 4 + 22 * 4 - 1), 3);
  assert.equal(slotsFor(10), 1, "never zero");
  const five = [1, 2, 3, 4, 5];
  assert.deepEqual(splitOverflow(five, 5), { shown: five, hidden: 0 });
  assert.deepEqual(splitOverflow(five, 6), { shown: five, hidden: 0 });
  assert.deepEqual(splitOverflow(five, 4), { shown: [1, 2, 3], hidden: 2 });
  assert.deepEqual(splitOverflow(five, 1), { shown: [], hidden: 5 });
});

test("repeat ghosts: every N days after the real date, only from today on, inside the range, capped", () => {
  const src = ev({ id: "deadline:x", entityId: "x", kind: "deadline", date: "2026-09-10", recurrenceDays: 7 });
  const g = projectGhosts([src], "2026-08-30", "2026-10-10", TODAY);
  // Sep 17, Sep 24 are in the past (before Sep 26) — not projected.
  assert.deepEqual(g.map((e) => e.date), ["2026-10-01", "2026-10-08"]);
  assert.ok(g.every((e) => e.ghost && e.realId === "deadline:x" && e.id.startsWith("ghost:x:")));
  // A future deadline repeats after itself, never on itself.
  const future = ev({ id: "deadline:y", entityId: "y", kind: "deadline", date: "2026-10-01", recurrenceDays: 14 });
  assert.deepEqual(projectGhosts([future], "2026-08-30", "2026-11-30", TODAY).map((e) => e.date), ["2026-10-15", "2026-10-29", "2026-11-12", "2026-11-26"]);
  // One-offs and records don't repeat.
  assert.equal(projectGhosts([ev({ id: "z", kind: "deadline", date: TODAY }), ev({ id: "r", kind: "applied", date: TODAY, recurrenceDays: 3 })], TODAY, "2026-12-31", TODAY).length, 0);
  // Daily repeats over a long range stop at the cap.
  assert.equal(projectGhosts([ev({ id: "d", kind: "deadline", date: TODAY, recurrenceDays: 1 })], TODAY, "2027-12-31", TODAY, 60).length, 60);
  // Across Feb 29.
  const leap = ev({ id: "l", kind: "deadline", date: "2028-02-27", recurrenceDays: 1 });
  assert.deepEqual(projectGhosts([leap], "2028-02-28", "2028-03-01", "2028-02-01").map((e) => e.date), ["2028-02-28", "2028-02-29", "2028-03-01"]);
});

test("drag rules: deadlines anywhere, applied only on or before today, history and ghosts never", () => {
  const dl = ev({ id: "d", kind: "deadline", date: TODAY });
  const applied = ev({ id: "a", kind: "applied", date: "2026-09-01" });
  const stage = ev({ id: "s", kind: "stage", date: "2026-09-01" });
  const ghost = ev({ id: "g", kind: "deadline", date: "2026-10-01", ghost: true });
  assert.ok(isDraggable(dl) && isDraggable(applied));
  assert.ok(!isDraggable(stage) && !isDraggable(ghost));
  assert.ok(canDrop(dl, "2027-01-01", TODAY) && canDrop(dl, "2020-01-01", TODAY));
  assert.ok(canDrop(applied, TODAY, TODAY));
  assert.ok(canDrop(applied, "2026-09-02", TODAY));
  assert.ok(!canDrop(applied, "2026-09-27", TODAY), "you can't have applied tomorrow");
  assert.ok(!canDrop(stage, "2026-09-02", TODAY));
  assert.ok(!canDrop(ghost, "2026-10-02", TODAY));
});

test("cellAtPoint maps a point to (row, col) and refuses points outside", () => {
  const rect = { left: 100, top: 50, width: 700, height: 600 };
  assert.deepEqual(cellAtPoint(rect, 100, 50, 6, 7), { row: 0, col: 0 });
  assert.deepEqual(cellAtPoint(rect, 799, 649, 6, 7), { row: 5, col: 6 });
  assert.deepEqual(cellAtPoint(rect, 350, 260, 6, 7), { row: 2, col: 2 });
  assert.equal(cellAtPoint(rect, 99, 60, 6, 7), null);
  assert.equal(cellAtPoint(rect, 400, 650, 6, 7), null);
});

test("describeDay", () => {
  assert.equal(describeDay([]), "nothing scheduled");
  assert.equal(describeDay([
    ev({ id: "1", kind: "deadline", date: TODAY }), ev({ id: "2", kind: "deadline", date: TODAY }),
    ev({ id: "3", kind: "applied", date: TODAY }), ev({ id: "4", kind: "stage", date: TODAY }),
    ev({ id: "5", kind: "deadline", date: TODAY, ghost: true }),
  ]), "2 deadlines, 1 application, 1 stage change");
});
