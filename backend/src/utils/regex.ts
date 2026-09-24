/** Safe regex construction for user-supplied search text. */

/** Escape every RegExp metacharacter so the input matches literally. Raw user
 *  input in `new RegExp()` throws on "C++" / "(" (a 500) and lets a crafted
 *  pattern backtrack the DB (ReDoS). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" matcher for a search box, or null when empty. */
export function searchRegex(term: unknown): RegExp | null {
  if (typeof term !== "string") return null;
  const trimmed = term.trim().slice(0, 200);
  return trimmed ? new RegExp(escapeRegex(trimmed), "i") : null;
}
