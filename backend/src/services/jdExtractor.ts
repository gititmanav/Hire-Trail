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

/** Look for any of the common salary patterns and return the first match
 *  *as it appears in the source*, lightly normalized. We keep the original
 *  formatting (with $ and dash) because that's what users expect to see. */
function extractSalary(text: string): string | undefined {
  const patterns: RegExp[] = [
    // $120,000 - $150,000  |  $120k - $150k  |  $120k–$150k
    /\$\s?[0-9]{2,3}(?:[,.][0-9]{3})*(?:k|K)?\s?[–—-]\s?\$\s?[0-9]{2,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\s?\/\s?year|\s?\/\s?yr|\s?\/\s?annum)?/,
    // $30/hr - $50/hr  |  $30 - $50 / hour
    /\$\s?[0-9]{1,3}(?:\.[0-9]{1,2})?\s?[–—-]\s?\$\s?[0-9]{1,3}(?:\.[0-9]{1,2})?\s?\/?\s?(?:hour|hr|h)\b/i,
    // single $120k/year
    /\$\s?[0-9]{2,3}(?:[,.][0-9]{3})*(?:k|K)?(?:\s?\/\s?(?:year|yr|annum|hour|hr))/i,
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

/** Heuristic location extractor. Looks for canonical "City, ST" or "City, Country"
 *  patterns near keywords like "Location:" or in the first 500 chars of the JD. */
function extractLocation(text: string): string | undefined {
  // Explicit "Location: X" label
  const labeled = text.match(/(?:^|\n)\s*Location\s*[:\-]\s*([^\n]{2,80})/i);
  if (labeled) return labeled[1].trim().replace(/\s+/g, " ");

  // "Remote" / "Hybrid" / "Onsite" near the start of the doc
  const headBlock = text.slice(0, 600);
  const modeMatch = headBlock.match(/\b(Remote(?:\s\(US\))?|Hybrid|On[\s-]?site|In[\s-]?Office)\b/i);
  const cityMatch = headBlock.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s([A-Z]{2}(?:\s[A-Z][a-z]+)?)\b/);
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
function extractCompany(text: string): string | undefined {
  const labeled = text.match(/(?:^|\n)\s*Company\s*[:\-]\s*([^\n]{2,80})/i);
  if (labeled) return labeled[1].trim();
  const about = text.match(/About\s+([A-Z][\w&'\.\- ]{1,40})(?:\s*[:\.\n])/);
  if (about) return about[1].trim();
  return undefined;
}

export function extractFieldsFromJD(jobDescription: string): ExtractedFields {
  if (!jobDescription || jobDescription.length < 80) return {};
  const text = jobDescription;
  const out: ExtractedFields = {};
  const title = extractTitle(text);
  if (title) out.title = title;
  const company = extractCompany(text);
  if (company) out.company = company;
  const location = extractLocation(text);
  if (location) out.location = location;
  const salary = extractSalary(text);
  if (salary) out.salary = salary;
  const jobType = extractJobType(text);
  if (jobType) out.jobType = jobType;
  return out;
}
