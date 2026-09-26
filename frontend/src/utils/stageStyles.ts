import type { Stage } from "../types";
import { cssPalette } from "./palette.ts";

export const STAGES: Stage[] = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"];

/** Stages that count toward the funnel — "Drafting" is pre-submission and excluded
 *  from response-rate / time-to-stage analytics. Use this in filter UIs where the
 *  funnel concept matters (Dashboard funnel widget, Kanban totals, etc.). */
export const FUNNEL_STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];

export const STAGE_BADGE_CLASS: Record<Stage, string> = {
  Drafting: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  Applied: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  OA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

/** Each stage's colour family. The 500 shade is THE stage colour: every dot,
 *  stripe, chip and chart reads it (tints for badges and columns are the same
 *  family at lighter shades). */
export const STAGE_FAMILY: Record<Stage, string> = {
  Drafting: "slate", Applied: "blue", OA: "amber", Interview: "purple", Offer: "emerald", Rejected: "red",
};

/** The stage colour as a CSS value (inline styles, color-mix washes, canvas).
 *  Resolves through the palette variables, so Custom themes re-tint it. */
export const STAGE_COLOR = Object.fromEntries(
  STAGES.map((s) => [s, cssPalette(`${STAGE_FAMILY[s]}-500`)]),
) as Record<Stage, string>;

/** A bordered, tinted stage badge — the inbox-scan cards and their review
 *  dialog. Same families as every other stage surface. */
export const STAGE_TONE_CLASS: Record<Stage, { bg: string; text: string; border: string }> = {
  Drafting:  { bg: "bg-slate-100 dark:bg-slate-800",         text: "text-slate-700 dark:text-slate-200",     border: "border-slate-200 dark:border-slate-700" },
  Applied:   { bg: "bg-blue-50 dark:bg-blue-950/40",         text: "text-blue-700 dark:text-blue-300",       border: "border-blue-200 dark:border-blue-900" },
  OA:        { bg: "bg-amber-50 dark:bg-amber-950/40",       text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-900" },
  Interview: { bg: "bg-purple-50 dark:bg-purple-950/40",     text: "text-purple-700 dark:text-purple-300",   border: "border-purple-200 dark:border-purple-900" },
  Offer:     { bg: "bg-emerald-50 dark:bg-emerald-950/40",   text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900" },
  Rejected:  { bg: "bg-red-50 dark:bg-red-950/40",           text: "text-red-700 dark:text-red-300",         border: "border-red-200 dark:border-red-900" },
};

/** Stripe color for the left edge of an application card. Single source of
 *  truth so every card surface (Applications row, Kanban card, future
 *  variants) renders the same hue for the same stage. 500-shade Tailwind
 *  classes — they match the Kanban column header dots and the calendar
 *  hexes, and they read crisply on both light and dark themes. */
export const STAGE_STRIPE_CLASS: Record<Stage, string> = {
  Drafting: "bg-slate-500",
  Applied: "bg-blue-500",
  OA: "bg-amber-500",
  Interview: "bg-purple-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-red-500",
};
