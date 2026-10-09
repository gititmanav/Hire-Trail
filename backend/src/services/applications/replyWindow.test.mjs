// The reply-window maths (replyWindow.ts). Run:
//   node --test src/services/applications/replyWindow.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REPLY_DAYS, median, replyWindowFrom } from "./replyWindow.ts";

test("median: odd count takes the middle value, in any input order", () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([3]), 3);
});

test("median: even count takes the rounded mean of the middle two", () => {
  assert.equal(median([1, 2, 3, 4]), 3); // 2.5 rounds up
  assert.equal(median([4, 10]), 7);
  assert.equal(median([2, 2, 3, 3]), 3); // 2.5
});

test("median: empty is 0", () => {
  assert.equal(median([]), 0);
});

test("fewer than five replies: the default window", () => {
  assert.deepEqual(replyWindowFrom([]), { days: DEFAULT_REPLY_DAYS, sample: 0, isDefault: true, lateReplies: 0 });
  assert.deepEqual(replyWindowFrom([1, 2, 40, 3]), { days: DEFAULT_REPLY_DAYS, sample: 4, isDefault: true, lateReplies: 1 });
});

test("five or more replies: their own median", () => {
  assert.deepEqual(replyWindowFrom([7, 3, 10, 5, 8]), { days: 7, sample: 5, isDefault: false, lateReplies: 0 });
});

test("a same-day median clamps to one day", () => {
  assert.deepEqual(replyWindowFrom([0, 0, 0, 1, 5]), { days: 1, sample: 5, isDefault: false, lateReplies: 1 });
});

test("late replies take more than twice the window", () => {
  // window 6 → late is > 12 (12 itself is not late)
  const w = replyWindowFrom([4, 5, 6, 6, 12, 13, 30]);
  assert.equal(w.days, 6);
  assert.equal(w.lateReplies, 2);
});
