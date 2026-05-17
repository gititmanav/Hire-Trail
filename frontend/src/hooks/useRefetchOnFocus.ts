/**
 * Re-run a fetcher when the tab regains focus or the document becomes visible.
 *
 * Solves the "extension created an application while my tab was in the background"
 * staleness — the dashboard refetches the moment the user looks at it again.
 *
 * Notes:
 * - `focus` and `visibilitychange` both fire in many cases; we debounce via
 *   `lastRunAt` so the same trip back to the tab only triggers one refetch.
 * - We skip the very first focus event if the tab loads already-focused — the
 *   initial load handles that case.
 */
import { useEffect, useRef } from "react";

interface Options {
  /** Disable the listener (e.g. while a modal owns focus or page is loading). */
  enabled?: boolean;
  /** Minimum ms between successive refetches. Defaults to 5_000. */
  minIntervalMs?: number;
}

export function useRefetchOnFocus(refetch: () => void | Promise<void>, opts: Options = {}) {
  const { enabled = true, minIntervalMs = 5_000 } = opts;
  const lastRunRef = useRef(0);
  // Always call the latest refetch without re-binding listeners on every render.
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  useEffect(() => {
    if (!enabled) return;

    const maybeRefetch = () => {
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      lastRunRef.current = now;
      void refetchRef.current();
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        maybeRefetch();
      }
    };

    window.addEventListener("focus", maybeRefetch);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", maybeRefetch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, minIntervalMs]);
}
