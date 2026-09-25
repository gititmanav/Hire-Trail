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

/** Solid colors for calendar chips (matches STAGE_BADGE_CLASS intent). CSS
 *  values — they resolve through the palette variables. */
export const STAGE_CALENDAR_COLOR: Record<Stage, { backgroundColor: string; borderColor: string }> = {
  Drafting: { backgroundColor: cssPalette("slate-500"), borderColor: cssPalette("slate-600") },
  Applied: { backgroundColor: cssPalette("blue-600"), borderColor: cssPalette("blue-700") },
  OA: { backgroundColor: cssPalette("amber-600"), borderColor: cssPalette("amber-700") },
  Interview: { backgroundColor: cssPalette("purple-600"), borderColor: cssPalette("purple-700") },
  Offer: { backgroundColor: cssPalette("emerald-600"), borderColor: cssPalette("emerald-700") },
  Rejected: { backgroundColor: cssPalette("red-600"), borderColor: cssPalette("red-700") },
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
