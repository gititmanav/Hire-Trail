// The one place that decides what an application is waiting on. Run under
// several zones (a stage move is a moment; a picked day is UTC midnight):
//   for tz in Asia/Kolkata America/Los_Angeles Pacific/Auckland UTC; do
//     TZ=$tz node --test src/pages/Applications/data/focus.test.ts; done
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REPLY_WINDOW, daysInStage, historySteps, isCold, momentum, nextDeadlines, rowFocus, sortApplications,
  stageSummary, trailShape, type ReplyWindow,
} from "./focus.ts";
import { addDaysYmd } from "../../../utils/dates.ts";
import type { Application, Deadline, Stage } from "../../../types";

const TODAY = "2026-10-08";
const RW: ReplyWindow = { days: 11, sample: 13, isDefault: false, lateReplies: 2 };

/** A moment at local noon `ago` days before today — a stage move. */
const moment = (ago: number) => {
  const [y, m, d] = addDaysYmd(TODAY, -ago).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0).toISOString();
};
/** A picked day `ago` days before today — stored as UTC midnight. */
const picked = (ago: number) => `${addDaysYmd(TODAY, -ago)}T00:00:00.000Z`;

let seq = 0;
function app(stage: Stage, hist: [Stage, number][], extra: Partial<Application> = {}): Application {
  const id = `a${++seq}`;
  return {
    _id: id, userId: "u", company: `Co ${id}`, companyId: null, role: "Engineer", jobUrl: "",
    applicationDate: picked(hist[0]?.[1] ?? 0), stage, stageHistory: hist.map(([s, ago]) => ({ stage: s, date: moment(ago) })),
    notes: "", resumeId: null, tailorSessionId: null, contactId: null, outreachStatus: "none",
    archived: false, archivedAt: null, archivedReason: null, hasJobDescription: true,
    createdAt: moment(hist[0]?.[1] ?? 0), updatedAt: moment(0), ...extra,
  };
}
const deadline = (a: Application, type: string, inDays: number, extra: Partial<Deadline> = {}): Deadline => ({
  _id: `d-${a._id}-${type}`, userId: "u", applicationId: a._id, type, dueDate: picked(-inDays), completed: false,
  notes: "", createdAt: moment(1), updatedAt: moment(1), ...extra,
});

test("history: legacy documents and backdated applied days", () => {
  const noHistory = app("Interview", [], { applicationDate: picked(30), stageHistory: undefined as never });
  assert.deepEqual(historySteps(noHistory), [{ stage: "Interview", day: addDaysYmd(TODAY, -30) }]);

  const startsAtOA = app("OA", [["OA", 5]], { applicationDate: picked(12) });
  assert.deepEqual(historySteps(startsAtOA).map((s) => s.stage), ["Applied", "OA"], "an Applied step is put in front");

  const backdated = app("Applied", [["Applied", 2]], { applicationDate: picked(20) });
  assert.equal(historySteps(backdated)[0].day, addDaysYmd(TODAY, -20), "the applied day pulls the first step back");
  assert.equal(daysInStage(backdated, TODAY), 20);

  const unsorted = app("Interview", [["Interview", 3], ["Applied", 30]]);
  assert.deepEqual(historySteps(unsorted).map((s) => s.stage), ["Applied", "Interview"]);
});

test("next deadlines: the soonest open one per application, overdue first", () => {
  const a = app("OA", [["Applied", 10], ["OA", 2]]);
  const map = nextDeadlines([
    deadline(a, "OA due date", 5),
    deadline(a, "Follow-up reminder", -2),
    deadline(a, "Interview prep", -40),
    deadline(a, "Thank you note", 1, { completed: true }),
    { ...deadline(a, "Other", 0), applicationId: null },
  ], TODAY);
  assert.equal(map.get(a._id)?.type, "Follow-up reminder", "an abandoned one (40d overdue) doesn't count");
});

test("focus: each stage answers its own question", () => {
  const offer = app("Offer", [["Applied", 61], ["Offer", 5]], { salary: "$58/hr" });
  const f1 = rowFocus(offer, deadline(offer, "Offer decision", 4), RW, TODAY);
  assert.match(f1.text, /^Decide by /);
  assert.equal(f1.detail, "in 4d · $58/hr");
  assert.equal(f1.tone, "fg");

  const oa = app("OA", [["Applied", 9], ["OA", 2]]);
  assert.equal(rowFocus(oa, deadline(oa, "OA due date", 1), RW, TODAY).text, "OA due tomorrow");
  assert.equal(rowFocus(oa, deadline(oa, "OA due date", 1), RW, TODAY).tone, "warn");
  const late = rowFocus(oa, deadline(oa, "OA due date", -1), RW, TODAY);
  assert.deepEqual([late.text, late.tone], ["OA overdue", "danger"]);

  const fresh = app("Applied", [["Applied", 4]]);
  assert.deepEqual([rowFocus(fresh, undefined, RW, TODAY).text, rowFocus(fresh, undefined, RW, TODAY).tone], ["Sent 4d ago", "fg"]);
  const silent = app("Applied", [["Applied", 31]]);
  const fs = rowFocus(silent, undefined, RW, TODAY);
  assert.deepEqual([fs.text, fs.detail, fs.tone], ["Silent 31d", "past your reply window", "muted"]);
  assert.equal(rowFocus(silent, deadline(silent, "Follow-up reminder", 1), RW, TODAY).text, "Follow up tomorrow");

  const quiet = app("Interview", [["Applied", 45], ["Interview", 19]]);
  assert.equal(rowFocus(quiet, undefined, RW, TODAY).text, "Quiet 19d");

  const draft = app("Drafting", [["Drafting", 3]]);
  assert.equal(rowFocus(draft, undefined, RW, TODAY).text, "Not sent yet");
  assert.equal(rowFocus({ ...draft, hasJobDescription: false }, undefined, RW, TODAY).text, "Needs job description");

  const rejected = app("Rejected", [["Applied", 60], ["Interview", 40], ["Rejected", 30]]);
  const fr = rowFocus(rejected, undefined, RW, TODAY);
  assert.deepEqual([fr.text, fr.detail], ["Closed after 30d", "reached Interview"]);
});

test("momentum and cold trails", () => {
  const moving = app("Interview", [["Applied", 22], ["Interview", 3]]);
  assert.equal(momentum(moving, undefined, TODAY), "motion");
  const waiting = app("Applied", [["Applied", 26]]);
  assert.equal(momentum(waiting, undefined, TODAY), "waiting");
  assert.equal(momentum(waiting, deadline(waiting, "Follow-up reminder", 3), TODAY), "motion", "a dated step soon is motion");
  assert.equal(momentum(app("Drafting", [["Drafting", 1]]), undefined, TODAY), "drafts");
  assert.equal(momentum(app("Rejected", [["Applied", 10], ["Rejected", 2]]), undefined, TODAY), "closed");

  assert.equal(isCold(waiting, undefined, RW, TODAY), true);
  assert.equal(isCold(waiting, deadline(waiting, "Follow-up reminder", 20), RW, TODAY), true, "a step weeks away doesn't warm it");
  assert.equal(isCold(app("Applied", [["Applied", 9]]), undefined, RW, TODAY), false, "inside the window");
  assert.equal(isCold(app("Offer", [["Applied", 90], ["Offer", 60]]), undefined, RW, TODAY), false, "offers never go cold");
});

test("trail shape", () => {
  const stripe = app("Offer", [["Applied", 61], ["OA", 50], ["Interview", 38], ["Offer", 5]]);
  const t = trailShape(stripe, deadline(stripe, "Offer decision", 4), RW, TODAY);
  assert.deepEqual(t.segments.map((s) => [s.stage, s.from, s.to]), [["Applied", -61, -50], ["OA", -50, -38], ["Interview", -38, -5], ["Offer", -5, 0]]);
  assert.equal(t.live, true);
  assert.deepEqual(t.next, { at: 4, label: "Decide", overdue: false });
  const late = trailShape(stripe, deadline(stripe, "Offer decision", -3), RW, TODAY);
  assert.deepEqual(late.next, { at: -3, label: "Decision overdue · 3d", overdue: true });

  const rejected = app("Rejected", [["Applied", 60], ["Interview", 40], ["Rejected", 30]]);
  const r = trailShape(rejected, undefined, RW, TODAY);
  assert.equal(r.closedAt, -30);
  assert.deepEqual(r.segments.map((s) => s.stage), ["Applied", "Interview"]);
  assert.equal(r.segments[1].to, -30, "the trail ends where it ended");
  assert.equal(r.live, false);

  const cold = trailShape(app("Applied", [["Applied", 44]]), undefined, RW, TODAY);
  assert.deepEqual(cold.fade, { from: -44 + RW.days, to: -44 + 2 * RW.days });
  assert.equal(cold.live, false);
});

test("order and summaries", () => {
  const a = app("Applied", [["Applied", 20]]);
  const b = app("Applied", [["Applied", 3]]);
  const c = app("Applied", [["Applied", 40]]);
  const next = nextDeadlines([deadline(c, "Follow-up reminder", 1)], TODAY);
  assert.deepEqual(sortApplications([a, b, c], "smart", next, TODAY).map((x) => x._id), [c._id, b._id, a._id]);
  assert.equal(stageSummary("Applied", [a, b, c], next, RW, TODAY), "replies usually come within 11 days");
  const d = app("Applied", [["Applied", 50]]);
  assert.equal(stageSummary("Applied", [a, d], new Map(), RW, TODAY), "replies usually come within 11 days · 1 past it");
  assert.equal(DEFAULT_REPLY_WINDOW.days, 14);
});
