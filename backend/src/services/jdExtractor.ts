/**
 * Pure heuristic extractor: pulls a few well-formed structured fields out of a
 * raw job-description blob using regex patterns. Conservative on purpose —
 * only emits a value when the match has high confidence so we never overwrite
 * a user-typed field with a low-quality guess.
 *
 * Designed for fire-and-forget use after Application creation: when the
 * browser extension misses (e.g. Greenhouse's loading SPA didn't render the
 * salary block before the user clicked Apply), this fills the gap in the
 * background. No LLM dependency, no API call, no cost.
 */

export interface ExtractedFields {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  jobType?: string;
}

const JOB_TYPE_PATTERNS: Array<{ re: RegExp; canonical: string }> = [
  { re: /\bintern(ship)?\b/i,            canonical: "Internship" },
  { re: /\bco-?op\b/i,                   canonical: "Co-op" },
  { re: /\bfull[\s-]?time\b/i,           canonical: "Full-time" },
  { re: /\bpart[\s-]?time\b/i,           canonical: "Part-time" },
  { re: /\bcontract(or|ing)?\b/i,        canonical: "Contract" },
  { re: /\btemporary\b/i,                canonical: "Temporary" },
  { re: /\bfreelance\b/i,                canonical: "Freelance" },
];

/** Strip HTML tags + decode the most common entities before any regex sees
 *  the body. Extension grabs frequently leave `<p>` / `<span>` artifacts and
 *  encoded characters that confuse the title-case heuristic and the
 *  "first non-trivial line" heuristic. Safe to call on already-clean text. */
function stripHtml(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Currency-symbol character class used by every salary pattern. Order
 *  matters in the source string only when we need to render — for matching
 *  it's a simple alternation: $, €, £, ¥. Extending this is the cheapest
 *  way to add international coverage. */
const CURRENCY = "[$€£¥]";

/** Look for any of the common salary patterns and return the first match
 *  *as it appears in the source*, lightly normalized. We keep the original
 *  formatting (currency symbol + dash) because that's what users expect. */
function extractSalary(text: string): string | undefined {
  // `[0-9]{1,3}(?:[,.][0-9]{3})*` accepts both 3-digit standalone ("800") AND
  // 1-3 digits followed by comma groups ("1,200"). The k-suffix / `/year`
  // suffix below acts as the noise filter — a bare "$5" with no comma group
  // and no k/period suffix won't match either annual pattern.
  const patterns: RegExp[] = [
    // 120,000 - 150,000 | 120k - 150k | 120k–150k | €/£/¥ variants
    new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?\\s?[–—-]\\s?${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\\s?\\/\\s?year|\\s?\\/\\s?yr|\\s?\\/\\s?annum)?`),
    // Hourly range 30/hr - 50/hr | 30 - 50 / hour (currency-agnostic)
    new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:\\.[0-9]{1,2})?\\s?[–—-]\\s?${CURRENCY}\\s?[0-9]{1,3}(?:\\.[0-9]{1,2})?\\s?\\/?\\s?(?:hour|hr|h)\\b`, "i"),
    // Single 120k/year (currency-agnostic) — must carry a period/k suffix
    // to avoid matching arbitrary numbers like "$5".
    new RegExp(`${CURRENCY}\\s?[0-9]{1,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\\s?\\/\\s?(?:year|yr|annum|hour|hr))`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return undefined;
}

/** Find a job-type keyword anywhere in the text. */
function extractJobType(text: string): string | undefined {
  for (const { re, canonical } of JOB_TYPE_PATTERNS) {
    if (re.test(text)) return canonical;
  }
  return undefined;
}

/** Small allow-list of country names recognised in "City, Country" patterns.
 *  Intentionally conservative — we'd rather miss a rare country than match
 *  a non-country word that happens to follow "City, ". */
const COUNTRY_NAMES = [
  "USA", "United States", "UK", "United Kingdom", "Canada", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Sweden", "Norway", "Denmark",
  "Finland", "Switzerland", "Austria", "Belgium", "Ireland", "Poland",
  "Portugal", "Romania", "Greece", "Israel", "India", "Singapore", "Japan",
  "Australia", "New Zealand", "Brazil", "Mexico", "Argentina", "Chile",
  "Colombia", "China", "Korea", "South Korea", "Taiwan", "Hong Kong",
  "Indonesia", "Philippines", "Vietnam", "Thailand", "South Africa",
  "United Arab Emirates", "UAE", "Saudi Arabia", "Turkey", "Czech Republic",
];

/** Heuristic location extractor. Looks for canonical "City, ST" / "City,
 *  Country" patterns near keywords like "Location:" or in the first 600
 *  chars of the JD. */
function extractLocation(text: string): string | undefined {
  // Explicit "Location: X" label — always strongest signal when present.
  const labeled = text.match(/(?:^|\n)\s*Location\s*[:\-]\s*([^\n]{2,80})/i);
  if (labeled) return labeled[1].trim().replace(/\s+/g, " ");

  // "Remote" / "Hybrid" / "Onsite" near the start of the doc
  const headBlock = text.slice(0, 600);
  const modeMatch = headBlock.match(/\b(Remote(?:\s\(US\))?|Hybrid|On[\s-]?site|In[\s-]?Office)\b/i);

  // US-style "City, ST" — two uppercase letter state code is unambiguous.
  const cityStMatch = headBlock.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s([A-Z]{2}(?:\s[A-Z][a-z]+)?)\b/);

  // "City, Country" — country name allow-listed so we don't false-positive
  // on noun phrases that happen to follow a comma. We support multi-word
  // countries by trying each name as a literal anchor.
  const countryAlt = COUNTRY_NAMES.map((c) => c.replace(/\s+/g, "\\s")).join("|");
  const cityCountryRe = new RegExp(`\\b([A-Z][a-zA-Zà-ÿ]+(?:[\\s\\-][A-Z][a-zA-Zà-ÿ]+)?),\\s(${countryAlt})\\b`);
  const cityCountryMatch = headBlock.match(cityCountryRe);

  // Pick the strongest combination: city + mode (if both), else city alone,
  // else mode alone. City-state takes priority over city-country when both
  // appear (US JDs frequently include "Remote (US)" + a state-coded city).
  const cityMatch = cityStMatch || cityCountryMatch;
  if (cityMatch && modeMatch) return `${cityMatch[0]} · ${modeMatch[0]}`;
  if (cityMatch) return cityMatch[0];
  if (modeMatch) return modeMatch[0];
  return undefined;
}

/** Pull a job title by looking at the very top of the JD (often the first
 *  heading-style line). Returns undefined if nothing confident is found. */
function extractTitle(text: string): string | undefined {
  const labeled = text.match(/(?:^|\n)\s*(?:Position|Job Title|Role)\s*[:\-]\s*([^\n]{4,120})/i);
  if (labeled) return labeled[1].trim();

  // First non-trivial line of the document, if it reads like a title
  // (Title Case, 3-80 chars, not punctuation-heavy).
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 80);
  for (const line of lines.slice(0, 5)) {
    if (/[.,;:!?]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 12) continue;
    // Title-case heuristic: at least half the words start with a capital.
    const capCount = words.filter((w) => /^[A-Z]/.test(w)).length;
    if (capCount / words.length >= 0.5) return line;
  }
  return undefined;
}

/** "About {Company}" or "Company: X" — best-effort. */
function extractCompanyFromText(text: string): string | undefined {
  const labeled = text.match(/(?:^|\n)\s*Company\s*[:\-]\s*([^\n]{2,80})/i);
  if (labeled) return labeled[1].trim();
  const about = text.match(/About\s+([A-Z][\w&'\.\- ]{1,40})(?:\s*[:\.\n])/);
  if (about) return about[1].trim();
  return undefined;
}

/** Recognise known ATS hosts whose URL path encodes the employer's company
 *  slug. This is the single highest-leverage extraction signal we have for
 *  company name — way more reliable than parsing the JD body, where company
 *  is often only mentioned obliquely or buried in marketing copy. */
const ATS_HOST_PATTERNS: Array<{ re: RegExp; slugFromPath?: (path: string) => string | undefined }> = [
  // boards.greenhouse.io/{company}/jobs/123
  { re: /(?:^|\.)greenhouse\.io$/i, slugFromPath: (p) => p.split("/").filter(Boolean)[0] },
  // jobs.lever.co/{company}/uuid
  { re: /(?:^|\.)lever\.co$/i,      slugFromPath: (p) => p.split("/").filter(Boolean)[0] },
  // {company}.wd1.myworkdayjobs.com → subdomain holds the company
  { re: /\.myworkdayjobs\.com$/i,   slugFromPath: () => undefined }, // handled via host below
  // jobs.ashbyhq.com/{company}/uuid
  { re: /(?:^|\.)ashbyhq\.com$/i,   slugFromPath: (p) => p.split("/").filter(Boolean)[0] },
  // smartrecruiters.com/{company}/...
  { re: /(?:^|\.)smartrecruiters\.com$/i, slugFromPath: (p) => p.split("/").filter(Boolean)[0] },
];

/** Slugs like "stripe-eng" → "Stripe Eng" (best-effort prettifier). */
function prettifySlug(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  const clean = slug.replace(/^[a-z]+\d*-?/i, (m) => m).trim();
  if (clean.length < 2 || clean.length > 60) return undefined;
  // Drop trailing job-board noise tokens.
  const pieces = clean.split(/[-_]/).filter(Boolean);
  if (pieces.length === 0) return undefined;
  return pieces
    .map((p) => /^[A-Z][a-z]+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

/** Extract company name from a known-ATS job URL. Returns undefined when the
 *  host isn't a recognised ATS or the path/subdomain doesn't yield a slug. */
export function companyFromJobUrl(jobUrl: string | undefined | null): string | undefined {
  if (!jobUrl) return undefined;
  let parsed: URL;
  try { parsed = new URL(jobUrl); } catch { return undefined; }
  const host = parsed.hostname.toLowerCase();
  // Workday: company is the leftmost subdomain ({company}.wd1.myworkdayjobs.com).
  if (/\.myworkdayjobs\.com$/i.test(host)) {
    const sub = host.split(".")[0];
    return prettifySlug(sub);
  }
  for (const ats of ATS_HOST_PATTERNS) {
    if (ats.re.test(host) && ats.slugFromPath) {
      const slug = ats.slugFromPath(parsed.pathname);
      const pretty = prettifySlug(slug);
      if (pretty) return pretty;
    }
  }
  return undefined;
}

export function extractFieldsFromJD(jobDescription: string, jobUrl?: string | null): ExtractedFields {
  if (!jobDescription || jobDescription.length < 80) {
    // Even with no JD text, URL-derived company is still a useful signal —
    // the extension may have grabbed only the URL.
    const company = companyFromJobUrl(jobUrl);
    return company ? { company } : {};
  }
  // Strip HTML once so every downstream heuristic operates on clean text.
  const text = stripHtml(jobDescription);
  const out: ExtractedFields = {};
  const title = extractTitle(text);
  if (title) out.title = title;
  // URL-derived company beats text-derived (much higher recall + precision
  // on extension-captured apps). Text fallback only fires when URL extraction
  // yields nothing.
  const urlCompany = companyFromJobUrl(jobUrl);
  const company = urlCompany ?? extractCompanyFromText(text);
  if (company) out.company = company;
  const location = extractLocation(text);
  if (location) out.location = location;
  const salary = extractSalary(text);
  if (salary) out.salary = salary;
  const jobType = extractJobType(text);
  if (jobType) out.jobType = jobType;
  return out;
}
