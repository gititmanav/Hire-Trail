/**
 * The age dot the old Board card wore (fresh → stale). The app reads an
 * application's "now" from pages/Applications/data/focus.ts since the
 * 2026-10-08 redesign; this only backs the landing story's Board replica
 * (pages/Landing/story) until that replica is redrawn in the new card style.
 */

export type HealthTone = "fresh" | "warm" | "cooling" | "stale" | "neutral";

export const HEALTH_DOT_CLASS: Record<HealthTone, string> = {
  fresh: "bg-emerald-500",
  warm: "bg-amber-500",
  cooling: "bg-orange-500",
  stale: "bg-red-500",
  neutral: "bg-slate-400",
};
