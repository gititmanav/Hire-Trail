// Source of truth lives in jdExtractor.ts. These tests guard the major
// recognition paths from regressing.
import test from "node:test";
import assert from "node:assert/strict";

const CURRENCY = "[$€£¥]";
const SALARY = [
  new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?\\s?[–—-]\\s?${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\\s?\\/\\s?year|\\s?\\/\\s?yr|\\s?\\/\\s?annum)?`),
  new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:\\.[0-9]{1,2})?\\s?[–—-]\\s?${CURRENCY}\\s?[0-9]{1,3}(?:\\.[0-9]{1,2})?\\s?\\/?\\s?(?:hour|hr|h)\\b`, "i"),
  new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\\s?\\/\\s?(?:year|yr|annum|hour|hr))`, "i"),
];
const matchAny = (re, text) => re.some((r) => r.test(text));

test("salary patterns: annual range with k ($)", () => {
  assert.ok(matchAny(SALARY, "Compensation: $120k–$150k / year"));
});
test("salary patterns: hourly range ($)", () => {
  assert.ok(matchAny(SALARY, "Pay is $30 - $50 / hour"));
});
test("salary patterns: euro range", () => {
  assert.ok(matchAny(SALARY, "Salary band €60k - €80k"));
});
test("salary patterns: pound annual range", () => {
  assert.ok(matchAny(SALARY, "Compensation: £55,000 - £75,000 / year"));
});
test("salary patterns: yen annual range", () => {
  assert.ok(matchAny(SALARY, "¥800k - ¥1,200k / year"));
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

/* ─── City, Country tests — small allow-list of country names ──────── */
const COUNTRIES = ["Germany", "United Kingdom", "Canada", "India", "Brazil", "Japan", "Australia"];
const cityCountryRe = new RegExp(`\\b([A-Z][a-zA-Zà-ÿ]+(?:[\\s\\-][A-Z][a-zA-Zà-ÿ]+)?),\\s(${COUNTRIES.join("|")})\\b`);

test("city, country: Berlin, Germany", () => {
  assert.match("Berlin, Germany · Hybrid", cityCountryRe);
});
test("city, country: Toronto, Canada", () => {
  assert.match("Office: Toronto, Canada", cityCountryRe);
});
test("city, country: no match on random comma word", () => {
  assert.doesNotMatch("Available, anywhere", cityCountryRe);
});

/* ─── HTML strip ────────────────────────────────────────────────────── */
function stripHtml(s) {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

test("strip html: removes tags and decodes entities", () => {
  const html = "<p>Software <b>Engineer</b> &amp; Architect</p><script>alert(1)</script>";
  assert.equal(stripHtml(html), "Software Engineer & Architect");
});

test("strip html: keeps inner text intact", () => {
  const html = "<h1>Senior Backend Engineer</h1>\n<p>Build distributed systems.</p>";
  const out = stripHtml(html);
  assert.ok(out.includes("Senior Backend Engineer"));
  assert.ok(out.includes("Build distributed systems."));
});

/* ─── ATS URL → company name ─────────────────────────────────────────── */
function companyFromJobUrl(jobUrl) {
  if (!jobUrl) return undefined;
  let parsed;
  try { parsed = new URL(jobUrl); } catch { return undefined; }
  const host = parsed.hostname.toLowerCase();
  const prettify = (slug) => {
    if (!slug) return undefined;
    const clean = slug.trim();
    if (clean.length < 2 || clean.length > 60) return undefined;
    const pieces = clean.split(/[-_]/).filter(Boolean);
    if (pieces.length === 0) return undefined;
    return pieces.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  };
  if (/\.myworkdayjobs\.com$/.test(host)) return prettify(host.split(".")[0]);
  const slug = parsed.pathname.split("/").filter(Boolean)[0];
  if (/(?:^|\.)greenhouse\.io$/.test(host)) return prettify(slug);
  if (/(?:^|\.)lever\.co$/.test(host))      return prettify(slug);
  if (/(?:^|\.)ashbyhq\.com$/.test(host))   return prettify(slug);
  if (/(?:^|\.)smartrecruiters\.com$/.test(host)) return prettify(slug);
  return undefined;
}

test("ATS URL → company: Greenhouse", () => {
  assert.equal(companyFromJobUrl("https://boards.greenhouse.io/stripe/jobs/4523"), "Stripe");
});
test("ATS URL → company: Lever", () => {
  assert.equal(companyFromJobUrl("https://jobs.lever.co/notion/abc-123"), "Notion");
});
test("ATS URL → company: Workday subdomain", () => {
  assert.equal(companyFromJobUrl("https://salesforce.wd1.myworkdayjobs.com/External"), "Salesforce");
});
test("ATS URL → company: Ashby with hyphenated slug", () => {
  assert.equal(companyFromJobUrl("https://jobs.ashbyhq.com/perplexity-ai/uuid"), "Perplexity Ai");
});
test("ATS URL → company: returns undefined for non-ATS host", () => {
  assert.equal(companyFromJobUrl("https://example.com/jobs/123"), undefined);
});
test("ATS URL → company: returns undefined for malformed URL", () => {
  assert.equal(companyFromJobUrl("not a url"), undefined);
});
