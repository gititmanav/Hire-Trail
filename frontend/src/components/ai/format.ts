/** Small formatting helpers for the AI surfaces. */

/** "just now" · "12m ago" · "3h ago" · "Oct 2" — for moments (key checks, last use). */
export function sinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Money for AI spend: cents when it's small, never "$0.00" for a real cost. */
export function usd(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
}

export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** Used in the last day — the edge flows. */
export function activeToday(iso: string | null | undefined): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < 86_400_000;
}

/** "Oct 31" for a reset date. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
