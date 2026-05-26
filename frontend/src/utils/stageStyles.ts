import type { Stage } from "../types";

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

export const STAGE_FILTER_ACTIVE_CLASS: Record<Stage, string> = {
  Drafting: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200",
  Applied: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/35 dark:text-blue-200",
  OA: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/35 dark:text-amber-200",
  Interview: "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-900/35 dark:text-purple-200",
  Offer: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200",
  Rejected: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/35 dark:text-red-200",
};

export const STAGE_FILTER_COUNT_CLASS: Record<Stage, string> = {
  Drafting: "bg-slate-200/80 text-slate-800 dark:bg-slate-700/50 dark:text-slate-100",
  Applied: "bg-blue-200/80 text-blue-800 dark:bg-blue-800/50 dark:text-blue-100",
  OA: "bg-amber-200/80 text-amber-800 dark:bg-amber-800/50 dark:text-amber-100",
  Interview: "bg-purple-200/80 text-purple-800 dark:bg-purple-800/50 dark:text-purple-100",
  Offer: "bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-100",
  Rejected: "bg-red-200/80 text-red-800 dark:bg-red-800/50 dark:text-red-100",
};

/** Solid colors for calendar / chart chips (matches STAGE_BADGE_CLASS intent). */
export const STAGE_CALENDAR_HEX: Record<Stage, { backgroundColor: string; borderColor: string }> = {
  Drafting: { backgroundColor: "#64748b", borderColor: "#475569" }, // slate-500
  Applied: { backgroundColor: "#2563eb", borderColor: "#1d4ed8" },
  OA: { backgroundColor: "#d97706", borderColor: "#b45309" },
  Interview: { backgroundColor: "#9333ea", borderColor: "#7e22ce" },
  Offer: { backgroundColor: "#059669", borderColor: "#047857" },
  Rejected: { backgroundColor: "#dc2626", borderColor: "#b91c1c" },
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
