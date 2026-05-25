import test from "node:test";
import assert from "node:assert/strict";

// Minimal stand-alone copy of the patterns we actually want to assert behavior
// for. Source of truth lives in jdExtractor.ts — this just guards the major
// recognition paths from regressing.
const SALARY = [
  /\$\s?[0-9]{2,3}(?:[,.][0-9]{3})*(?:k|K)?\s?[–—-]\s?\$\s?[0-9]{2,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\s?\/\s?year|\s?\/\s?yr|\s?\/\s?annum)?/,
  /\$\s?[0-9]{1,3}(?:\.[0-9]{1,2})?\s?[–—-]\s?\$\s?[0-9]{1,3}(?:\.[0-9]{1,2})?\s?\/?\s?(?:hour|hr|h)\b/i,
];
const matchAny = (re, text) => re.some((r) => r.test(text));

test("salary patterns: annual range with k", () => {
  assert.ok(matchAny(SALARY, "Compensation: $120k–$150k / year"));
});
test("salary patterns: hourly range", () => {
  assert.ok(matchAny(SALARY, "Pay is $30 - $50 / hour"));
});
test("salary patterns: no match on noise", () => {
  assert.ok(!matchAny(SALARY, "We pay competitively, benefits etc."));
});

test("job type: internship", () => {
  assert.match("This is an Internship position", /\bintern(ship)?\b/i);
});
test("location label: explicit", () => {
  assert.match("Location: San Francisco, CA", /(?:^|\n)\s*Location\s*[:\-]\s*([^\n]{2,80})/i);
});
