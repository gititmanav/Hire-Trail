/**
 * Subscribe to a `matchMedia()` query and re-render when it flips.
 *
 * SSR-safe (returns `false` until the first effect runs in the browser). Use
 * this when the layout needs to *behave* differently across breakpoints — for
 * pure-style differences, prefer Tailwind responsive classes.
 */
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    // Sync once on mount in case the query changed between render and effect.
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
