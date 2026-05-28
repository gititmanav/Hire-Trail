/**
 * Builds the optimized Gmail `q:` search string for first-scan backfill.
 *
 * Strategy: do as much filtering as we can on Google's side, before any
 * bytes leave their servers. That means a long disjunction of subject
 * keywords + phrases + recruiter vocabulary, scoped to `category:primary`
 * so promotions / social tabs are skipped.
 *
 * Keep the keyword set broad — false positives are cheap (pre-filter +
 * LLM will drop them), false negatives are not (a real job email never
 * gets the chance to be classified).
 *
 * The keyword list is intentionally written with phrases and continuous
 * tense ("applying", "applied for", "thanks for applying") because most
 * recruiter auto-replies use those forms — bare "apply" misses them.
 */

const SUBJECT_KEYWORDS: readonly string[] = [
  // verb forms — apply
  "apply",
  "applying",
  "applied",
  "application",
  "applications",

  // recruiter-speak phrases
  "thanks for applying",
  "thank you for applying",
  "thanks for your application",
  "thank you for your application",
  "your application",
  "we received",
  "we have received",
  "application received",
  "your submission",
  "submitted",
  "submission",

  // outcomes
  "next steps",
  "moving forward",
  "advancing",
  "advanced",
  "decision",
  "update on your",
  "regarding your application",
  "regarding your candidacy",
  "shortlisted",
  "selected",
  "not selected",
  "moving on",
  "unable to move forward",
  "no longer be moving",
  "not be moving forward",

  // assessments
  "online assessment",
  "coding challenge",
  "take-home",
  "assessment",
  "codility",
  "hackerrank",
  "coderpad",
  "leetcode",
  "screening",
  "phone screen",

  // interview
  "interview",
  "interviewing",
  "schedule",
  "scheduling",
  "calendar invite",
  "onsite",
  "loop",
  "hiring manager",
  "recruiter",
  "talent",

  // offer
  "offer",
  "offer letter",
  "extending an offer",
  "thrilled to offer",
  "pleased to offer",
  "verbal offer",

  // rejection
  "rejected",
  "rejection",
  "regret",
  "we regret",
  "unfortunately",
  "other candidates",
  "moved forward with other",

  // role/position/opportunity vocab
  "role",
  "position",
  "opportunity",
  "internship",
  "fellowship",
  "candidate",
  "candidacy",
  "career",
  "careers",
  "hiring",
];

/**
 * Quote phrases (anything with a space) and OR-join. Gmail's search supports
 * `subject:(a OR b OR c)` and respects quoted phrases inside.
 */
function buildSubjectClause(): string {
  const tokens = SUBJECT_KEYWORDS.map((k) => (k.includes(" ") ? `"${k}"` : k));
  return `subject:(${tokens.join(" OR ")})`;
}

/**
 * Build the full Gmail q: string for a first-scan window.
 *
 * Example output (slightly trimmed):
 *   `newer_than:15d category:primary subject:(apply OR applying OR "thanks for applying" OR ... OR career OR careers OR hiring)`
 */
export function buildFirstScanQuery(windowDays: number): string {
  return [
    `newer_than:${windowDays}d`,
    "category:primary",
    buildSubjectClause(),
  ].join(" ");
}
