// Plain-date helpers (utils/dates.ts). Run under several zones — the whole
// point of the module is that none of them shifts a day:
//   for tz in Asia/Kolkata America/Los_Angeles Pacific/Auckland UTC; do
//     TZ=$tz node --test src/utils/dates.test.ts src/utils/calendarGrid.test.ts; done
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysYmd, dayOf, diffDaysYmd, formatYmd, isYmd, parseYmd, relativeDay, shiftMonth, weekStartDay, weekStartOf,
  weekdayOrder, ymdOf,
} from "./dates.ts";

test("parse ↔ format round-trips every day 2024–2030", () => {
  let d = "2024-01-01";
  for (let i = 0; i < 366 * 7; i++) {
    const dt = parseYmd(d)!;
    assert.equal(formatYmd(dt), d);
    assert.equal(dt.getHours(), 0, `${d} parses to local midnight`);
    const next = addDaysYmd(d, 1);
    assert.ok(next > d, "Ymd strings sort in date order");
    d = next;
  }
});

test("parse rejects malformed input", () => {
  for (const bad of ["", null, undefined, "2026-7-1", "2026/07/01", "July 1", "2026-07-01T00:00:00Z"]) {
    assert.equal(parseYmd(bad as string), null, String(bad));
  }
  assert.ok(isYmd("2026-07-01"));
  assert.ok(!isYmd("2026-07-01T00:00:00Z"));
});

test("day arithmetic is exact across DST, month ends and Feb 29", () => {
  assert.equal(addDaysYmd("2024-02-28", 1), "2024-02-29");
  assert.equal(addDaysYmd("2024-02-29", 1), "2024-03-01");
  assert.equal(addDaysYmd("2025-02-28", 1), "2025-03-01");
  assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysYmd("2026-03-01", -1), "2026-02-28");
  // US spring-forward (Mar 8 2026), EU (Mar 29), NZ fall-back (Apr 5), US fall-back (Nov 1).
  for (const [a, b] of [["2026-03-07", "2026-03-09"], ["2026-03-28", "2026-03-30"], ["2026-04-04", "2026-04-06"], ["2026-10-31", "2026-11-02"]]) {
    assert.equal(diffDaysYmd(a, b), 2, `${a} → ${b}`);
    assert.equal(addDaysYmd(a, 2), b);
  }
  assert.equal(diffDaysYmd("2024-01-01", "2025-01-01"), 366);
  assert.equal(diffDaysYmd("2026-09-26", "2026-09-20"), -6);
  assert.equal(ymdOf(2026, 0, 0), "2025-12-31");
  assert.equal(ymdOf(2026, 12, 1), "2027-01-01");
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});

test("dayOf: plain days keep their date in every zone; moments take the local day", () => {
  // A picked day, stored by the API as UTC midnight.
  assert.equal(dayOf("2026-07-01T00:00:00.000Z"), "2026-07-01");
  assert.equal(dayOf("2024-02-29T00:00:00.000Z"), "2024-02-29");
  assert.equal(dayOf("2026-07-01"), "2026-07-01");
  // A moment is the viewer's local day — whatever zone this runs in.
  const moment = "2026-07-01T02:30:00.000Z";
  assert.equal(dayOf(moment), formatYmd(new Date(moment)));
  assert.equal(dayOf(new Date(2026, 6, 1, 23, 59)), "2026-07-01");
  assert.equal(dayOf(new Date(2026, 6, 1, 0, 0, 1)), "2026-07-01");
  for (const empty of [null, undefined, "", "garbage"]) assert.equal(dayOf(empty), "");
});

test("relativeDay words", () => {
  assert.equal(relativeDay("2026-09-26", "2026-09-26"), "Today");
  assert.equal(relativeDay("2026-09-27", "2026-09-26"), "Tomorrow");
  assert.equal(relativeDay("2026-09-25", "2026-09-26"), "Yesterday");
  assert.equal(relativeDay("2026-09-29", "2026-09-26"), "in 3 days");
  assert.equal(relativeDay("2026-09-22", "2026-09-26"), "4 days ago");
});

test("week start comes from the locale", () => {
  assert.equal(weekStartDay("en-US"), 0);
  assert.equal(weekStartDay("en-GB"), 1);
  assert.equal(weekStartDay("de-DE"), 1);
  assert.equal(weekStartDay("not a locale!"), 0);
  assert.deepEqual(weekdayOrder(1), [1, 2, 3, 4, 5, 6, 0]);
});

test("weekStartOf honours every week start", () => {
  // Sat 2026-09-26.
  assert.equal(weekStartOf("2026-09-26", 0), "2026-09-20");
  assert.equal(weekStartOf("2026-09-26", 1), "2026-09-21");
  assert.equal(weekStartOf("2026-09-26", 6), "2026-09-26");
  assert.equal(weekStartOf("2026-09-20", 0), "2026-09-20");
  assert.equal(weekStartOf("2026-09-20", 1), "2026-09-14");
  // Across a DST change and a year boundary.
  assert.equal(weekStartOf("2026-03-10", 0), "2026-03-08");
  assert.equal(weekStartOf("2027-01-02", 1), "2026-12-28");
});
