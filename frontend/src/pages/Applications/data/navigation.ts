/** Context the detail page needs from the list the user came from: the order
 *  they were looking at (for J/K next/previous) and where "Back" returns to
 *  (the exact view + filters). Session-scoped — a fresh tab starts clean. */

const KEY = "hiretrail-apps-detail-nav";
const SCROLL_PREFIX = "hiretrail-apps-scroll:";

export interface DetailNav {
  ids: string[];
  /** pathname + search of the originating view, e.g. "/applications/board?company=Stripe". */
  backTo: string;
}

export function rememberDetailNav(nav: DetailNav): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(nav)); } catch { /* storage full / disabled */ }
}

export function readDetailNav(): DetailNav | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DetailNav>;
    return Array.isArray(v.ids) && typeof v.backTo === "string" ? { ids: v.ids, backTo: v.backTo } : null;
  } catch {
    return null;
  }
}

/** Scroll position per list URL, restored when the user comes back. */
export function saveListScroll(url: string): void {
  try { sessionStorage.setItem(SCROLL_PREFIX + url, String(window.scrollY)); } catch { /* ignore */ }
}
export function takeListScroll(url: string): number | null {
  try {
    const v = sessionStorage.getItem(SCROLL_PREFIX + url);
    sessionStorage.removeItem(SCROLL_PREFIX + url);
    return v == null ? null : Number(v) || 0;
  } catch {
    return null;
  }
}
