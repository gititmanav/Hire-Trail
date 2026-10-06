/** The one match score (0–10) — how it reads everywhere.
 *
 *  The number is deterministic (backend services/resume/score.ts: keyword
 *  coverage of the role's requirements + resume completeness), so its words
 *  are fixed bands, the same ones the Studio gauge has always used. Colour is
 *  meaning here: strong / good / fair. */
import { cssPalette } from "./palette.ts";

export type ScoreBand = "strong" | "good" | "fair";

export function scoreBand(score: number): ScoreBand {
  if (score >= 7.5) return "strong";
  if (score >= 5) return "good";
  return "fair";
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  strong: "Strong match",
  good: "Good match",
  fair: "Weak match",
};

/** Text + dot classes per band (Tailwind palette, re-tintable by themes). */
export const SCORE_BAND_TEXT: Record<ScoreBand, string> = {
  strong: "text-emerald-600 dark:text-emerald-400",
  good: "text-amber-600 dark:text-amber-400",
  fair: "text-red-600 dark:text-red-400",
};

/** The ring colour for canvas/SVG strokes (a CSS colour, never a literal). */
export function scoreBandColor(band: ScoreBand): string {
  return cssPalette(band === "strong" ? "emerald-500" : band === "good" ? "amber-500" : "red-500");
}

export function formatScore(score: number): string {
  return (Math.round(Math.max(0, Math.min(10, score)) * 10) / 10).toFixed(1);
}

/** What the number measures — one sentence, used by every score's hover card. */
export const SCORE_EXPLAINER =
  "How much of what this role asks for your profile already shows, plus how complete your resume is. The same profile and posting always score the same — tailoring is how it moves.";
