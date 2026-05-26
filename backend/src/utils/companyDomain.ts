/**
 * Shared company-domain resolution helpers.
 *
 * Historical bug: when an Application was created with a jobUrl pointing at
 * a job-board host (Workday, Greenhouse, Lever, etc.), the Company doc was
 * created with `domain` = that host. The logo-fetch then used Google's S2
 * favicons against that domain and got the *job board's* logo instead of the
 * company's. The fix is to prefer a name-derived domain ("Google" →
 * "google.com") and ignore job-board hosts when extracting from URLs.
 *
 * These are pure functions — no DB access — so they're shared by the
 * applications POST flow (which creates Company docs) and the logo fetcher.
 */

/** Hosts that proxy job listings — we should never accept these as the
 *  company's own domain when sourcing a logo. */
const JOB_BOARD_DOMAINS: ReadonlySet<string> = new Set([
  "workday.com",
  "myworkdayjobs.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "taleo.net",
  "successfactors.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "wellfound.com",
  "angel.co",
  "ziprecruiter.com",
  "bamboohr.com",
  "jobvite.com",
  "breezy.hr",
  "workable.com",
  "recruitee.com",
  "applytojob.com",
  "monster.com",
  "simplyhired.com",
  "jobs.com",
  "rippling-ats.com",
  "ripplingats.com",
  "personio.com",
  "join.com",
  "teamtailor.com",
  "polymer.co",
  "polymerhq.io",
  "dover.com",
  "remote.com",
  "remoterocketship.com",
  "weworkremotely.com",
]);

/** True when the host is a known job-board / ATS / aggregator that
 *  shouldn't be treated as the company's own domain. Handles subdomains
 *  (e.g. "boards.greenhouse.io" → matches "greenhouse.io"). */
export function isJobBoardDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (JOB_BOARD_DOMAINS.has(d)) return true;
  for (const board of JOB_BOARD_DOMAINS) {
    if (d.endsWith("." + board)) return true;
  }
  return false;
}

/** Extract a normalised hostname from a URL. Returns "" if the URL is
 *  unparseable. Strips a leading "www." and lowercases. */
export function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Best-effort domain from a company name. Drops common corporate suffixes,
 *  lowercases, strips non-alphanum. Works for ~90% of common employers
 *  (Google → google.com, Goldman Sachs → goldmansachs.com, Two Sigma →
 *  twosigma.com). When it 404s upstream the logo simply doesn't render —
 *  no broken-image artefact. */
export function deriveDomainFromName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|gmbh|co|company)\.?\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "";
  return `${cleaned}.com`;
}

/** Pick the best domain to feed a logo lookup. Priority:
 *    1. Name-derived ("Google" → "google.com")
 *    2. URL-derived from a NON-job-board host (e.g. user manually set
 *       company.website to careers.google.com)
 *    3. Stored Company.domain, only if non-job-board (defensive)
 *  Returns "" when nothing usable is available.
 *
 *  Name-first matters because the URL-derived value frequently points at a
 *  job board for jobs the user tracked via the extension. */
export function resolveLogoDomain(input: { name: string; website?: string | null; domain?: string | null }): string {
  const fromName = deriveDomainFromName(input.name);
  if (fromName) return fromName;

  const fromWebsite = extractDomainFromUrl(input.website || "");
  if (fromWebsite && !isJobBoardDomain(fromWebsite)) return fromWebsite;

  const stored = (input.domain || "").toLowerCase();
  if (stored && !isJobBoardDomain(stored)) return stored;

  return "";
}

/** True when the company's stored domain points at a job board — used to
 *  detect "legacy bad" cached logos that need invalidating. */
export function shouldInvalidateCachedLogo(stored: { domain?: string | null }): boolean {
  return isJobBoardDomain((stored.domain || "").toLowerCase());
}
