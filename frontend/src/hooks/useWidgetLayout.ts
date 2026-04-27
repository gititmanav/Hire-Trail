/**
 * Persists dashboard widget layout and visibility in localStorage (react-grid-layout).
 */
import { useState, useCallback, useEffect } from "react";
import type { Layout } from "react-grid-layout";

export interface WidgetConfig { id: string; type: string; title: string; }

const SK = "hiretrail-widget-layout";
const SV = "hiretrail-widget-visible";
const SL = "hiretrail-dashboard-locked";
const keyForUser = (base: string, userId?: string | null) => (userId ? `${base}:${userId}` : base);

export const ALL_WIDGETS: WidgetConfig[] = [
  { id: "stats", type: "stats", title: "Key Metrics" },
  { id: "funnel", type: "funnel", title: "Application Funnel" },
  { id: "conversion", type: "conversion", title: "Conversion Rates" },
  { id: "trend", type: "trend", title: "Applications Over Time" },
  { id: "pie", type: "pie", title: "Stage Distribution" },
  { id: "resume-perf", type: "resume-perf", title: "Resume Performance" },
  { id: "recent-apps", type: "recent-apps", title: "Recent Applications" },
  { id: "deadlines", type: "deadlines", title: "Upcoming Deadlines" },
  { id: "follow-ups", type: "follow-ups", title: "Follow-up Queue" },
  { id: "mini-calendar", type: "mini-calendar", title: "Mini Calendar" },
];

// Initial 12-column grid when no saved layout exists (lg breakpoint).
const DEFAULT_LAYOUT: Layout[] = [
  { i: "stats", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: "recent-apps", x: 0, y: 2, w: 7, h: 6, minW: 4, minH: 4 },
  { i: "deadlines", x: 7, y: 2, w: 5, h: 6, minW: 3, minH: 4 },
  { i: "funnel", x: 0, y: 8, w: 6, h: 6, minW: 4, minH: 5 },
  { i: "pie", x: 6, y: 8, w: 3, h: 6, minW: 3, minH: 5 },
  { i: "resume-perf", x: 9, y: 8, w: 3, h: 6, minW: 3, minH: 5 },
  { i: "trend", x: 0, y: 14, w: 6, h: 6, minW: 4, minH: 5 },
  { i: "conversion", x: 6, y: 14, w: 6, h: 6, minW: 4, minH: 5 },
  { i: "follow-ups", x: 0, y: 20, w: 6, h: 4, minW: 4, minH: 3 },
  { i: "mini-calendar", x: 6, y: 20, w: 6, h: 6, minW: 4, minH: 5 },
];

function loadLayout(userId?: string | null): Layout[] {
  try { const s = localStorage.getItem(keyForUser(SK, userId)); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_LAYOUT;
}

function loadVisible(userId?: string | null): Record<string, boolean> {
  try { const s = localStorage.getItem(keyForUser(SV, userId)); if (s) return JSON.parse(s); } catch {}
  const d: Record<string, boolean> = {};
  ALL_WIDGETS.forEach((w) => { d[w.id] = true; });
  return d;
}

function loadLocked(userId?: string | null): boolean {
  try { return localStorage.getItem(keyForUser(SL, userId)) === "true"; } catch { return false; }
}

export function useWidgetLayout(userId?: string | null) {
  const [layout, setLayout] = useState<Layout[]>(() => loadLayout(userId));
  const [visible, setVisible] = useState<Record<string, boolean>>(() => loadVisible(userId));
  const [locked, setLocked] = useState(() => loadLocked(userId));

  useEffect(() => {
    setLayout(loadLayout(userId));
    setVisible(loadVisible(userId));
    setLocked(loadLocked(userId));
  }, [userId]);

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout((prev) => {
      const merged = prev.map((item) => {
        const updated = newLayout.find((n) => n.i === item.i);
        return updated ? { ...item, ...updated } : item;
      });
      newLayout.forEach((n) => { if (!merged.find((m) => m.i === n.i)) merged.push(n); });
      localStorage.setItem(keyForUser(SK, userId), JSON.stringify(merged));
      return merged;
    });
  }, [userId]);

  const toggleWidget = useCallback((id: string) => {
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(keyForUser(SV, userId), JSON.stringify(next));
      if (next[id]) {
        setLayout((prevLayout) => {
          const exists = prevLayout.find((l) => l.i === id);
          if (exists) return prevLayout;
          const defaultItem = DEFAULT_LAYOUT.find((d) => d.i === id);
          if (!defaultItem) return prevLayout;
          const maxY = prevLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
          const newItem = { ...defaultItem, y: maxY };
          const updated = [...prevLayout, newItem];
          localStorage.setItem(keyForUser(SK, userId), JSON.stringify(updated));
          return updated;
        });
      }
      return next;
    });
  }, [userId]);

  const toggleLock = useCallback(() => {
    setLocked((prev) => { const next = !prev; localStorage.setItem(keyForUser(SL, userId), String(next)); return next; });
  }, [userId]);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.setItem(keyForUser(SK, userId), JSON.stringify(DEFAULT_LAYOUT));
    const d: Record<string, boolean> = {};
    ALL_WIDGETS.forEach((w) => { d[w.id] = true; });
    setVisible(d);
    localStorage.setItem(keyForUser(SV, userId), JSON.stringify(d));
  }, [userId]);

  return { layout: layout.filter((l) => visible[l.i]), fullLayout: layout, visible, locked, onLayoutChange, toggleWidget, toggleLock, resetLayout };
}
