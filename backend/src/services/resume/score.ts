/**
 * Deterministic resume match score, 0–10 (task 8). NOT an LLM call — a pure
 * function of keyword coverage vs the JD and section completeness, so the same
 * document always scores the same and {before,after} on a rewrite is meaningful.
 *
 * Formula (documented in AI_RESUME_CONTRACT.md):
 *   completeness ∈ [0,1] — weighted checklist of resume hygiene:
 *     name+email 0.15 · summary 0.15 · ≥1 experience bullet 0.30 ·
 *     ≥5 skills 0.20 · education 0.10 · avg bullet ≥ 6 words 0.10
 *   coverage ∈ [0,1] — fraction of JD keywords present in the document.
 *
 *   with JD keywords:  score = (0.65·coverage + 0.35·completeness) · 10
 *   without keywords:  score = completeness · 10
 *
 * Rounded to 1 decimal.
 */
import type { ResumeDocument } from "./types.js";
import { extractDocText, keywordCoverage } from "./keywords.js";

function completeness(doc: ResumeDocument): number {
  let score = 0;
  if (doc.meta.name && doc.meta.contact.email) score += 0.15;

  const summary = doc.sections.find((s) => s.type === "summary");
  const summaryText = (summary?.entries?.[0]?.extra as { text?: string } | undefined)?.text ?? "";
  if (summaryText.trim()) score += 0.15;

  const exp = doc.sections.find((s) => s.type === "experience");
  const expBullets = exp?.entries.reduce((n, e) => n + e.bullets.length, 0) ?? 0;
  if (expBullets >= 1) score += 0.3;

  const skills = doc.sections.find((s) => s.type === "skills");
  const skillCount =
    skills?.entries.reduce((n, e) => n + ((e.extra as { items?: string[] } | undefined)?.items?.length ?? 0), 0) ?? 0;
  if (skillCount >= 5) score += 0.2;

  if (doc.sections.some((s) => s.type === "education" && s.entries.length > 0)) score += 0.1;

  // Average bullet length — punchy quantified bullets read better than fragments.
  const allBullets = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets));
  if (allBullets.length) {
    const avgWords = allBullets.reduce((n, b) => n + b.text.trim().split(/\s+/).length, 0) / allBullets.length;
    if (avgWords >= 6) score += 0.1;
  }
  return Math.min(1, score);
}

export function computeScore(doc: ResumeDocument, jdKeywords: string[] = []): number {
  const comp = completeness(doc);
  let raw: number;
  if (jdKeywords.length > 0) {
    const { coverageCount, total } = keywordCoverage(jdKeywords, extractDocText(doc));
    const coverage = total > 0 ? coverageCount / total : 0;
    raw = (0.65 * coverage + 0.35 * comp) * 10;
  } else {
    raw = comp * 10;
  }
  return Math.round(raw * 10) / 10;
}
