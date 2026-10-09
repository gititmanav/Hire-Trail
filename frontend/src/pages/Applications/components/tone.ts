/** A focus line's tone → text colour. Colour only where it means something:
 *  a date in the next day or two (amber), something overdue (red). */
import type { Tone } from "../data/focus.ts";

export const TONE_CLASS: Record<Tone, string> = {
  fg: "text-foreground",
  muted: "text-muted-foreground",
  warn: "text-amber-700 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};
