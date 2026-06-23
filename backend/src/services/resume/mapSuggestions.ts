/**
 * Map AI tailor suggestions onto a specific ResumeDocument's stable ids.
 *
 * The brain (services/ai/tailor.ts) addresses targets by FUZZY human strings —
 * `section` (enum), `targetCompanyOrName`, `targetBullet` — because it analyzes
 * the master profile, not a specific editable document. The editor + AI-rewrite
 * pipeline (rewrite.ts, changedPaths) address by stable ids (e.g. "s2e1b3").
 *
 * This deterministic resolver bridges the two so the Align step can turn a
 * suggestion into a scoped rewrite. No LLM. On a miss it degrades gracefully to
 * the section scope (so a suggestion is never silently dropped).
 */
import type { ResumeDocument, RewriteScope, SectionType } from "./types.js";
import type { ITailorSuggestion } from "../../models/TailorSession.js";

export interface ResolvedSuggestion {
  suggestion: ITailorSuggestion;
  scope: RewriteScope | "all";
  /** Set when the suggestion resolves to a specific bullet. */
  bulletId?: string;
  /** Match strength: an exact bullet, a section/entry fallback, or unmatched. */
  confidence: "exact" | "section" | "none";
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length > 2));
}

/** Token-overlap ratio in [0,1], normalized by the smaller token set. */
function overlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

/** The brain's section enum (`project`) → the document's section type. */
function sectionTypeFor(s: ITailorSuggestion["section"]): SectionType {
  return s === "project" ? "projects" : s;
}

function resolveOne(doc: ResumeDocument, sug: ITailorSuggestion): ResolvedSuggestion {
  const type = sectionTypeFor(sug.section);
  const section = doc.sections.find((s) => s.type === type);
  if (!section) return { suggestion: sug, scope: "all", confidence: "none" };

  // Summary is a single-entry section; "add" has no existing target. Both scope
  // to the whole section (the Align step treats them accordingly).
  if (type === "summary" || sug.kind === "add") {
    return { suggestion: sug, scope: { sectionId: section.id }, confidence: "section" };
  }

  // Find the targeted entry by company/name.
  const wantEntry = norm(sug.targetCompanyOrName);
  let bestEntry: ResumeDocument["sections"][number]["entries"][number] | undefined;
  let bestEntryScore = 0;
  if (wantEntry) {
    for (const e of section.entries) {
      const hay = norm([e.org, e.title].filter(Boolean).join(" "));
      if (!hay) continue;
      const score = hay.includes(wantEntry) || wantEntry.includes(hay) ? 1 : overlap(hay, wantEntry);
      if (score > bestEntryScore) { bestEntryScore = score; bestEntry = e; }
    }
  }
  const entry = bestEntryScore >= 0.5 ? bestEntry : undefined;

  // Find the bullet by text — within the matched entry, else across the section.
  const wantBullet = sug.targetBullet.trim();
  if (wantBullet) {
    const pool = entry
      ? entry.bullets.map((b) => ({ e: entry, b }))
      : section.entries.flatMap((e) => e.bullets.map((b) => ({ e, b })));
    let best: { e: typeof section.entries[number]; b: { id: string; text: string } } | undefined;
    let bestScore = 0;
    for (const cand of pool) {
      const score = overlap(cand.b.text, wantBullet);
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    if (best && bestScore >= 0.5) {
      return {
        suggestion: sug,
        scope: { sectionId: section.id, entryId: best.e.id },
        bulletId: best.b.id,
        confidence: "exact",
      };
    }
  }

  if (entry) return { suggestion: sug, scope: { sectionId: section.id, entryId: entry.id }, confidence: "section" };
  return { suggestion: sug, scope: { sectionId: section.id }, confidence: "section" };
}

export function resolveSuggestionTargets(doc: ResumeDocument, suggestions: ITailorSuggestion[]): ResolvedSuggestion[] {
  return suggestions.map((s) => resolveOne(doc, s));
}
