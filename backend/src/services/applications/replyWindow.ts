/**
 * The reply window — how long companies usually take to answer this person:
 * the median of their reply times, in whole days. Pure (no imports), so
 * `replyWindow.test.mjs` runs it straight under `node --test`.
 */

/** Until there are enough replies to measure, assume two weeks. */
export const DEFAULT_REPLY_DAYS = 14;
export const MIN_REPLY_SAMPLE = 5;

export interface ReplyWindow {
  days: number;
  /** How many applications' replies were measured. */
  sample: number;
  /** True when `days` is the default, not their own median. */
  isDefault: boolean;
  /** Replies that took more than twice the window. */
  lateReplies: number;
}

/** The median; an even count takes the rounded mean of the middle two. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** The window from reply times in whole days (one per application). */
export function replyWindowFrom(replyDays: number[]): ReplyWindow {
  const sample = replyDays.length;
  const isDefault = sample < MIN_REPLY_SAMPLE;
  const days = isDefault ? DEFAULT_REPLY_DAYS : Math.max(1, median(replyDays));
  return { days, sample, isDefault, lateReplies: replyDays.filter((d) => d > 2 * days).length };
}
