/** Sidebar collapse for an app shell (Layout, AdminLayout): remembered per
 *  shell on this device, and toggled as a view transition — the browser
 *  snapshots the shell before and after and animates the snapshots on the
 *  compositor (App.css, "Sidebar collapse"), so the page lays out once
 *  instead of every frame. A live width transition re-lays-out and
 *  re-rasters the whole main card per frame, which drops frames on big
 *  screens. Without View Transitions the CSS width/margin fallback runs. */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "../utils/motion.ts";

export function useShellCollapse(storageKey: string): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [storageKey, collapsed]);

  const transitionToken = useRef(0);
  const toggle = () => {
    const next = !collapsed;
    if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
      setCollapsed(next);
      return;
    }
    const root = document.documentElement;
    const token = ++transitionToken.current;
    root.classList.add("vt-shell");
    const transition = document.startViewTransition(() => flushSync(() => setCollapsed(next)));
    // A quick second toggle supersedes the first; only the latest clears the names.
    void transition.finished.finally(() => { if (transitionToken.current === token) root.classList.remove("vt-shell"); });
  };

  return [collapsed, toggle];
}
