/**
 * Persists admin dashboard widget layout and visibility in localStorage (react-grid-layout).
 */
import { useState, useCallback } from "react";
import type { Layout } from "react-grid-layout";

export interface AdminWidgetConfig { id: string; title: string; }

const SK = "hiretrail-admin-widget-layout";
const SV = "hiretrail-admin-widget-visible";
const SL = "hiretrail-admin-dashboard-locked";

export const ADMIN_WIDGETS: AdminWidgetConfig[] = [
  { id: "stats", title: "Key Metrics" },
  { id: "user-growth", title: "User Growth" },
  { id: "apps-per-day", title: "Applications Per Day" },
  { id: "activity", title: "Recent Activity" },
  { id: "conversion-rates", title: "Conversion Rates" },
  { id: "funnel", title: "Platform Funnel" },
  { id: "top-companies", title: "Top 10 Companies" },
  { id: "top-roles", title: "Top 10 Roles" },
  { id: "summary", title: "Platform Summary" },
];

const DEFAULT_LAYOUT: Layout[] = [
  { i: "stats", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: "user-growth", x: 0, y: 2, w: 6, h: 6, minW: 4, minH: 5 },
  { i: "apps-per-day", x: 6, y: 2, w: 6, h: 6, minW: 4, minH: 5 },
  { i: "activity", x: 0, y: 8, w: 12, h: 6, minW: 6, minH: 4 },
  { i: "conversion-rates", x: 0, y: 14, w: 12, h: 3, minW: 6, minH: 3 },
  { i: "funnel", x: 0, y: 17, w: 12, h: 6, minW: 6, minH: 5 },
  { i: "top-companies", x: 0, y: 23, w: 6, h: 7, minW: 4, minH: 5 },
  { i: "top-roles", x: 6, y: 23, w: 6, h: 7, minW: 4, minH: 5 },
  { i: "summary", x: 0, y: 30, w: 12, h: 2, minW: 6, minH: 2 },
];

function loadLayout(): Layout[] {
  try { const s = localStorage.getItem(SK); if (s) return JSON.parse(s); } catch {}
  return DEFAULT_LAYOUT;
}

function loadVisible(): Record<string, boolean> {
  try { const s = localStorage.getItem(SV); if (s) return JSON.parse(s); } catch {}
  const d: Record<string, boolean> = {};
  ADMIN_WIDGETS.forEach((w) => { d[w.id] = true; });
  return d;
}

function loadLocked(): boolean {
  try { return localStorage.getItem(SL) === "true"; } catch { return false; }
}

export function useAdminWidgetLayout() {
  const [layout, setLayout] = useState<Layout[]>(loadLayout);
  const [visible, setVisible] = useState<Record<string, boolean>>(loadVisible);
  const [locked, setLocked] = useState(loadLocked);

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout((prev) => {
      const merged = prev.map((item) => {
        const updated = newLayout.find((n) => n.i === item.i);
        return updated ? { ...item, ...updated } : item;
      });
      newLayout.forEach((n) => { if (!merged.find((m) => m.i === n.i)) merged.push(n); });
      localStorage.setItem(SK, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(SV, JSON.stringify(next));
      if (next[id]) {
        setLayout((prevLayout) => {
          const exists = prevLayout.find((l) => l.i === id);
          if (exists) return prevLayout;
          const defaultItem = DEFAULT_LAYOUT.find((d) => d.i === id);
          if (!defaultItem) return prevLayout;
          const maxY = prevLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
          const newItem = { ...defaultItem, y: maxY };
          const updated = [...prevLayout, newItem];
          localStorage.setItem(SK, JSON.stringify(updated));
          return updated;
        });
      }
      return next;
    });
  }, []);

  const toggleLock = useCallback(() => {
    setLocked((prev) => { const next = !prev; localStorage.setItem(SL, String(next)); return next; });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.setItem(SK, JSON.stringify(DEFAULT_LAYOUT));
    const d: Record<string, boolean> = {};
    ADMIN_WIDGETS.forEach((w) => { d[w.id] = true; });
    setVisible(d);
    localStorage.setItem(SV, JSON.stringify(d));
  }, []);

  return { layout: layout.filter((l) => visible[l.i]), fullLayout: layout, visible, locked, onLayoutChange, toggleWidget, toggleLock, resetLayout };
}
