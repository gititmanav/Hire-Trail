/**
 * Contextual rewrite suggestion chips (task 8).
 *
 * Derived deterministically from the gap analysis + document state:
 *   - missing JD keywords → "Add <kw>" chips (scope: all)
 *   - weak action verbs    → "Strengthen weak verbs" (scope: experience)
 *   - over-long summary     → "Tighten summary" (scope: summary)
 *   - thin skills section   → "Group & expand skills" (scope: skills)
 * Falls back to a fixed, always-useful set when nothing specific is detected, so
 * the UI never shows an empty chip rail.
 */
import type { ResumeDocument, SuggestionChip, RewriteScope } from "./types.js";
import { entryHasWeakVerb, type KeywordGap } from "./keywords.js";

const SUMMARY_WORD_LIMIT = 60;
const MAX_KEYWORD_CHIPS = 5;

function sectionScope(doc: ResumeDocument, type: string): RewriteScope | "all" {
  const s = doc.sections.find((sec) => sec.type === type);
  return s ? { sectionId: s.id } : "all";
}

const FALLBACK_CHIPS: Omit<SuggestionChip, "scope">[] = [
  { id: "fallback-quantify", label: "Quantify impact", instruction: "Add concrete numbers (%, $, scale, time saved) to bullets where the candidate's real results support them. Never invent metrics." },
  { id: "fallback-verbs", label: "Stronger action verbs", instruction: "Replace weak openers (worked on, helped, responsible for) with strong, specific action verbs." },
  { id: "fallback-concise", label: "Tighten wording", instruction: "Tighten every bullet to one line of high-signal wording; remove filler." },
];

export function buildSuggestionChips(doc: ResumeDocument, gap?: KeywordGap): SuggestionChip[] {
  const chips: SuggestionChip[] = [];

  // 1. Missing keywords the candidate may genuinely have.
  for (const kw of (gap?.missing ?? []).slice(0, MAX_KEYWORD_CHIPS)) {
    chips.push({
      id: `kw-${kw.replace(/\s+/g, "-").toLowerCase()}`,
      label: `Add “${kw}”`,
      instruction: `Weave the keyword "${kw}" into a relevant bullet or the skills list ONLY if the candidate genuinely has this experience. Do not fabricate.`,
      scope: "all",
    });
  }

  // 2. Weak verbs in experience.
  const expSection = doc.sections.find((s) => s.type === "experience");
  if (expSection && expSection.entries.some(entryHasWeakVerb)) {
    chips.push({
      id: "weak-verbs",
      label: "Strengthen weak verbs",
      instruction: "Rewrite bullets that start with weak verbs (worked on, helped, responsible for, assisted) to lead with strong action verbs and surface impact the candidate already achieved.",
      scope: sectionScope(doc, "experience"),
    });
  }

  // 3. Over-long summary.
  const summarySection = doc.sections.find((s) => s.type === "summary");
  const summaryText = (summarySection?.entries?.[0]?.extra as { text?: string } | undefined)?.text ?? "";
  if (summaryText && summaryText.trim().split(/\s+/).length > SUMMARY_WORD_LIMIT) {
    chips.push({
      id: "tighten-summary",
      label: "Tighten summary",
      instruction: "Tighten the summary to 2-3 punchy sentences focused on the target role; cut filler and generic claims.",
      scope: sectionScope(doc, "summary"),
    });
  }

  // 4. Thin skills section.
  const skillsSection = doc.sections.find((s) => s.type === "skills");
  const skillCount =
    skillsSection?.entries.reduce((n, e) => n + ((e.extra as { items?: string[] } | undefined)?.items?.length ?? 0), 0) ?? 0;
  if (skillsSection && skillCount > 0 && skillCount < 5) {
    chips.push({
      id: "expand-skills",
      label: "Group & expand skills",
      instruction: "Group skills into clear categories and surface tools/technologies the candidate has used in their experience but didn't list. Do not add skills they lack.",
      scope: sectionScope(doc, "skills"),
    });
  }

  if (chips.length === 0) {
    return FALLBACK_CHIPS.map((c) => ({ ...c, scope: "all" as const }));
  }
  return chips;
}
