/**
 * Keyword extraction + coverage for the keyword-gap analysis and the
 * deterministic match score.
 *
 * The authoritative JD keyword set comes from the LLM analysis (matchedSkills +
 * missingSkills). `extractJdKeywords` is a deterministic fallback used when no
 * analysis is available. `keywordCoverage` is a pure function — same inputs
 * always yield the same gap, which is what makes the score reproducible.
 */
import type { ResumeDocument, DocEntry } from "./types.js";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has",
  "this", "that", "from", "they", "them", "their", "what", "who", "which", "work",
  "team", "role", "job", "skills", "experience", "ability", "strong", "years",
  "year", "must", "plus", "etc", "into", "across", "within", "using", "such",
  "about", "would", "should", "could", "more", "than", "also", "able", "well",
]);

export function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#./ -]/g, "").trim();
}

/** Flatten all human-readable text in a document into one lowercased blob. */
export function extractDocText(doc: ResumeDocument): string {
  const parts: string[] = [doc.meta.name];
  for (const section of doc.sections) {
    parts.push(section.title);
    for (const entry of section.entries) {
      parts.push(entry.org, entry.title, entry.location);
      parts.push(...entry.bullets.map((b) => b.text));
      const extra = entry.extra as Record<string, unknown> | undefined;
      if (extra) {
        if (typeof extra.text === "string") parts.push(extra.text);
        if (typeof extra.description === "string") parts.push(extra.description);
        if (Array.isArray(extra.items)) parts.push(...(extra.items as string[]));
        if (Array.isArray(extra.technologies)) parts.push(...(extra.technologies as string[]));
      }
    }
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** True when a (possibly multi-word) keyword appears in the doc text. Single
 *  tokens match on word boundaries to avoid "go" matching "category". */
function present(keyword: string, docText: string): boolean {
  const k = normalizeKeyword(keyword);
  if (!k) return false;
  if (k.includes(" ") || /[+#./]/.test(k)) return docText.includes(k);
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}([^a-z0-9]|$)`).test(docText);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface KeywordGap {
  matched: string[];
  missing: string[];
  /** Number of JD keywords the resume already covers. */
  coverageCount: number;
  /** Total distinct JD keywords considered. */
  total: number;
}

export function keywordCoverage(jdKeywords: string[], docText: string): KeywordGap {
  const seen = new Set<string>();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const raw of jdKeywords) {
    const k = normalizeKeyword(raw);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (present(raw, docText)) matched.push(raw);
    else missing.push(raw);
  }
  return { matched, missing, coverageCount: matched.length, total: matched.length + missing.length };
}

/** Deterministic JD keyword extractor (fallback). Pulls notable capitalized
 *  tokens + known tech terms; conservative so the gap stays meaningful. */
export function extractJdKeywords(jdText: string, limit = 30): string[] {
  const out = new Map<string, number>();
  const tokens = jdText.split(/[^a-zA-Z0-9+#./-]+/).filter(Boolean);
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.length < 3 || STOPWORDS.has(lower)) continue;
    // Keep tech-ish tokens (contain a symbol/digit) or Capitalized proper nouns.
    const techy = /[0-9+#./]/.test(tok);
    const proper = /^[A-Z][a-zA-Z0-9]+$/.test(tok);
    if (!techy && !proper) continue;
    out.set(lower, (out.get(lower) ?? 0) + 1);
  }
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/** Helper used by suggestions: which sections an entry-level fix should target. */
export function entryHasWeakVerb(entry: DocEntry): boolean {
  return entry.bullets.some((b) => /^(worked on|helped|responsible for|assisted|participated)/i.test(b.text.trim()));
}
