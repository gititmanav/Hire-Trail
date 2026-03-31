/**
 * Theme hook: applies tweakcn-compatible CSS variables, persists selection in localStorage.
 * Themes with isDark=true/false that have no variable overrides use the CSS :root / .dark defaults.
 * Themes with variable overrides inject them directly onto the root element.
 */
import { useState, useEffect, useCallback } from "react";
import { getTheme } from "../utils/themes.ts";
import type { Theme } from "../utils/themes.ts";

const STORAGE_KEY = "hiretrail-theme-id";

// All CSS variable keys that a theme can override
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

  // Clear any previous inline overrides so CSS :root / .dark defaults take effect
  for (const v of ALL_VARS) {
    root.style.removeProperty(v);
  }

  // Toggle dark class
  if (theme.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply the appropriate variable set
  const vars = theme.isDark && theme.darkVariables
    ? theme.darkVariables
    : theme.variables;

  if (Object.keys(vars).length > 0) {
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  // Smooth transition
  root.style.setProperty("transition", "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease");
}

function resolveInitialId(): string {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  // Migrate from old key
  const legacy = localStorage.getItem("hiretrail-theme");
  if (legacy === "dark") return "dark";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "default";
}

export function useTheme() {
  const [themeId, setThemeId] = useState(resolveInitialId);
  const currentTheme = getTheme(themeId);

  useEffect(() => {
    applyTheme(currentTheme);
    localStorage.setItem(STORAGE_KEY, currentTheme.id);
  }, [currentTheme]);

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
