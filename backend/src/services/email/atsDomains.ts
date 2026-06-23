/**
 * Sender-domain allowlist for known ATS (applicant tracking system) and
 * recruiting-platform email senders. Any message from one of these is
 * almost certainly job-related and skips the regex pre-filter — straight
 * into the classification pool.
 *
 * Match logic: the sender's domain is compared via case-insensitive
 * `endsWith`, so `careers.notifications.greenhouse.io` matches
 * `greenhouse.io`. Subdomains under these roots all qualify.
 *
 * Keep this list broad. False positives just cost a tiny bit of LLM
 * inference; false negatives mean a real application gets dropped.
 */
export const ATS_DOMAINS: readonly string[] = [
  // Major ATS providers
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "hire.lever.co",
  "ashbyhq.com",
  "ashby.com",
  "workday.com",
  "myworkdayjobs.com",
  "myworkday.com",
  "smartrecruiters.com",
  "jobvite.com",
  "taleo.net",
  "icims.com",
  "breezy.hr",
  "recruitee.com",
  "workable.com",
  "successfactors.com",
  "bamboohr.com",
  "rippling.com",
  "rippling-mail.com",
  "gem.com",
  "hireflix.com",
  "rooster.jobs",
  "polymer.co",
  "personio.com",
  "teamtailor.com",
  "freshteam.com",
  "applytojob.com",
  "jobscore.com",
  "pinpointhq.com",
  "trakstar.com",
  "trinethire.com",
  "manatal.com",
  "comeet.com",
  "wd1.myworkdayjobs.com",
  "wd5.myworkdayjobs.com",
  "wd103.myworkdayjobs.com",

  // Job boards that send application receipts
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "wellfound.com",
  "ycombinator.com",
  "otta.com",
  "welcometothejungle.com",
  "hired.com",
  "monster.com",
  "dice.com",
  "builtin.com",
  "angel.co",
  "handshake.com",
  "joinhandshake.com",
  "ripplematch.com",
  "simplify.jobs",

  // University career-services platforms (common for students)
  "12twenty.com",
  "symplicity.com",

  // Common recruiter / mailer relays
  "myworkdayservices.com",
  "icims-mailer.com",
];

const ATS_DOMAINS_SET = new Set(ATS_DOMAINS.map((d) => d.toLowerCase()));

/** True when the `from`'s domain is (or is a subdomain of) any known ATS host. */
export function isAtsSender(fromDomain: string): boolean {
  const d = fromDomain.toLowerCase().trim();
  if (!d) return false;
  if (ATS_DOMAINS_SET.has(d)) return true;
  for (const root of ATS_DOMAINS) {
    if (d.endsWith("." + root)) return true;
  }
  return false;
}

/** Common newsletter / promotional senders we *never* want to classify, even if
 *  the subject happens to contain a keyword like "opportunity". This list lets
 *  us drop them before they ever hit the LLM. */
const NEWSLETTER_PATTERNS = [
  /^newsletter@/i,
  /^digest@/i,
  /^updates?@/i,
  /^marketing@/i,
  /^promo(tions?)?@/i,
  /^deals?@/i,
  /no-?reply@(.*)medium\.com$/i,
  /no-?reply@(.*)substack\.com$/i,
  /@news\./i,
  /@email\.(marketing|promo)/i,
];

export function isLikelyNewsletter(fromHeader: string): boolean {
  const f = fromHeader.toLowerCase();
  return NEWSLETTER_PATTERNS.some((re) => re.test(f));
}

/** Negative subject/body signals — job-board ALERTS and marketing that look
 *  job-adjacent but are NOT applications the user submitted. Job boards (LinkedIn,
 *  Indeed…) are on the ATS allowlist because they also send genuine receipts, so
 *  we filter their alert/digest noise here by content instead of by sender. */
const NEGATIVE_KEYWORD_RE = new RegExp(
  [
    "job alert",
    "jobs for you",
    "new jobs",
    "recommended (for you|jobs)",
    "jobs you may",
    "based on your (profile|searches)",
    "weekly digest",
    "daily digest",
    "top picks",
    "people you may know",
    "who'?s hiring",
    "trending",
    "unsubscribe to stop",
    "view all jobs",
    "\\d+\\s+new (jobs|roles|openings)",
    "% off",
    "webinar",
    "promotion",
    "newsletter",
    "course",
    "upgrade to premium",
    "sponsored",
  ].join("|"),
  "i",
);

/** True when subject/body head reads like a job-board alert or marketing blast
 *  rather than a personal application thread. */
export function hasNegativeSignal(subject: string, bodyHead: string): boolean {
  return NEGATIVE_KEYWORD_RE.test(`${subject}\n${bodyHead}`);
}
