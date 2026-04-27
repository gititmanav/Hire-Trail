import type { Stage } from "../types";

export const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];

export const STAGE_BADGE_CLASS: Record<Stage, string> = {
  Applied: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  OA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export const STAGE_FILTER_ACTIVE_CLASS: Record<Stage, string> = {
  Applied: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/35 dark:text-blue-200",
  OA: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/35 dark:text-amber-200",
  Interview: "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-900/35 dark:text-purple-200",
  Offer: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200",
  Rejected: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/35 dark:text-red-200",
};

export const STAGE_FILTER_COUNT_CLASS: Record<Stage, string> = {
  Applied: "bg-blue-200/80 text-blue-800 dark:bg-blue-800/50 dark:text-blue-100",
  OA: "bg-amber-200/80 text-amber-800 dark:bg-amber-800/50 dark:text-amber-100",
  Interview: "bg-purple-200/80 text-purple-800 dark:bg-purple-800/50 dark:text-purple-100",
  Offer: "bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-100",
  Rejected: "bg-red-200/80 text-red-800 dark:bg-red-800/50 dark:text-red-100",
};
