/**
 * Theme hook: applies tweakcn-compatible CSS variables, persists selection in localStorage.
 *
 * IMPORTANT: applyTheme() runs synchronously during render (not in useEffect) so that
 * CSS variables are set BEFORE any child useEffect hooks fire. This ensures chart widgets
 * and other components that read CSS variables in effects always get the current values.
 */
import { useState, useEffect, useCallback } from "react";
import { getTheme } from "../utils/themes.ts";
import type { Theme } from "../utils/themes.ts";

const STORAGE_KEY = "hiretrail-theme-id";
const keyForUser = (userId?: string | null) =>
  userId != null && String(userId) !== "" ? `${STORAGE_KEY}:${String(userId)}` : STORAGE_KEY;

/** Survives Strict Mode remounts so we do not clear/reapply CSS variables twice in a row. */
let lastDomAppliedThemeId: string | null = null;

const ALL_VARS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Toggle light/dark before variables so Tailwind `dark:` matches incoming tokens.
  if (theme.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const vars = theme.isDark && theme.darkVariables
    ? theme.darkVariables
    : theme.variables;

  // Never strip all variables in one shot — that frame makes `hsl(var(--primary))` etc.
  // invalid and causes visible flashes (e.g. Kanban column drop zones using accent/primary).
  for (const key of ALL_VARS) {
    const value = vars[key as keyof typeof vars];
    if (value !== undefined && value !== "") {
      root.style.setProperty(key, value);
    } else {
      root.style.removeProperty(key);
    }
  }
}

function syncThemeToDocument(theme: Theme) {
  if (lastDomAppliedThemeId === theme.id) return;
  lastDomAppliedThemeId = theme.id;
  applyTheme(theme);
}

function resolveInitialId(userId?: string | null): string {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(keyForUser(userId));
  if (stored) return stored;
  const legacy = localStorage.getItem("hiretrail-theme");
  if (legacy === "dark") return "dark";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "default";
}

export function useTheme(userId?: string | null) {
  const [themeId, setThemeId] = useState(() => resolveInitialId(userId));
  const currentTheme = getTheme(themeId);

  // Apply CSS variables synchronously during render — NOT in useEffect.
  // This guarantees child useEffect hooks (e.g. chart widgets) read fresh values.
  syncThemeToDocument(currentTheme);

  // Keep React state aligned with real theme ids (e.g. legacy "dark" → concrete preset id).
  useEffect(() => {
    const canonical = getTheme(themeId).id;
    if (canonical !== themeId) setThemeId(canonical);
  }, [themeId]);

  // When auth resolves or the account changes, load that user's saved theme.
  // Do not depend on themeId: after setTheme(), this would run before the persist
  // effect updates localStorage, read the stale id, and fight the user's choice (flicker).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) return;
    const canonical = getTheme(raw).id;
    setThemeId((prev) => (prev === canonical ? prev : canonical));
  }, [userId]);

  // Persist canonical id (side effect, so kept in useEffect)
  useEffect(() => {
    const canonical = getTheme(themeId).id;
    localStorage.setItem(keyForUser(userId), canonical);
  }, [themeId, userId]);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
  }, []);

  const toggle = useCallback((_e?: React.MouseEvent) => {
    setThemeId((prev) => {
      const cur = getTheme(prev);
      return cur.isDark ? "default" : "dark";
    });
  }, []);

  return { dark: currentTheme.isDark, toggle, themeId: currentTheme.id, setTheme, currentTheme };
}
