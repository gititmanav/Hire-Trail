/**
 * Manages importing and applying custom themes from tweakcn.com URLs.
 * Themes are stored in localStorage and applied via CSS custom properties.
 */
import { useState, useEffect, useCallback } from "react";
import { proxyAPI } from "../utils/api.ts";

const STORAGE_KEY = "hiretrail-custom-themes";
const ACTIVE_THEME_KEY = "hiretrail-active-theme";

export interface SavedTheme {
  name: string;
  url: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  importedAt: string;
}

/** Map tweakcn CSS variable names to HireTrail variable names. */
const TWEAKCN_MAP: Record<string, string> = {
  "--primary": "--ht-accent",
  "--primary-foreground": "--ht-accent-light",
  "--background": "--ht-page-bg",
  "--destructive": "--ht-danger",
  "--sidebar-background": "--ht-sidebar-bg",
  "--sidebar-foreground": "--ht-sidebar-text",
  "--sidebar-accent": "--ht-sidebar-active",
  "--sidebar-accent-foreground": "--ht-sidebar-hover",
  "--accent": "--ht-accent-hover",
  "--muted": "--ht-sidebar-hover",
};

/** Extract CSS variables from a :root { ... } or .dark { ... } block. */
function parseCSSBlock(css: string, selector: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Match the selector block
  const patterns = [
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]+)\\}`, "g"),
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(css)) !== null) {
      const block = match[1];
      const varPattern = /(--[\w-]+)\s*:\s*([^;]+)/g;
      let varMatch;
      while ((varMatch = varPattern.exec(block)) !== null) {
        vars[varMatch[1].trim()] = varMatch[2].trim();
      }
    }
  }
  return vars;
}

/** Extract CSS variables from tweakcn HTML response. */
function extractThemeVars(html: string): { light: Record<string, string>; dark: Record<string, string> } {
  // Find all <style> tags content
  const styleContent: string[] = [];
  const stylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = stylePattern.exec(html)) !== null) {
    styleContent.push(match[1]);
  }

  // Also check for inline CSS in data attributes or script tags that might contain theme data
  const allCSS = styleContent.join("\n");

  // Also try to find CSS in script tags (some frameworks inline CSS in JS)
  const scriptPattern = /:root\s*\{[^}]+\}/g;
  const scriptMatch = html.match(scriptPattern);
  const fullCSS = allCSS + (scriptMatch ? "\n" + scriptMatch.join("\n") : "");

  const light = parseCSSBlock(fullCSS, ":root");
  const dark = parseCSSBlock(fullCSS, ".dark");

  return { light, dark };
}

/** Map tweakcn variables to HireTrail variables. */
function mapToHireTrail(vars: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [tweakcnKey, htKey] of Object.entries(TWEAKCN_MAP)) {
    if (vars[tweakcnKey]) {
      mapped[htKey] = vars[tweakcnKey];
    }
  }
  // Also pass through any --ht-* variables directly
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith("--ht-")) {
      mapped[key] = value;
    }
  }
  return mapped;
}

/** Apply a set of CSS variables to the document root. */
function applyVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

/** Remove applied theme variables from document root. */
function clearVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key);
  }
}

function loadThemes(): SavedTheme[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveThemes(themes: SavedTheme[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

export function useThemeImport() {
  const [themes, setThemes] = useState<SavedTheme[]>(loadThemes);
  const [activeTheme, setActiveTheme] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_THEME_KEY)
  );
  const [importing, setImporting] = useState(false);

  // Apply active theme on mount
  useEffect(() => {
    if (activeTheme) {
      const theme = themes.find((t) => t.name === activeTheme);
      if (theme) {
        const isDark = document.documentElement.classList.contains("dark");
        const vars = isDark ? { ...mapToHireTrail(theme.light), ...mapToHireTrail(theme.dark) } : mapToHireTrail(theme.light);
        applyVars(vars);
      }
    }
  }, [activeTheme, themes]);

  // Re-apply when dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (activeTheme) {
        const theme = themes.find((t) => t.name === activeTheme);
        if (theme) {
          const isDark = document.documentElement.classList.contains("dark");
          const vars = isDark ? { ...mapToHireTrail(theme.light), ...mapToHireTrail(theme.dark) } : mapToHireTrail(theme.light);
          applyVars(vars);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [activeTheme, themes]);

  const importTheme = useCallback(async (url: string, name?: string) => {
    setImporting(true);
    try {
      const { html } = await proxyAPI.fetchTweakcn(url);
      const { light, dark } = extractThemeVars(html);

      if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
        throw new Error("No CSS variables found in the page. The theme may load dynamically.");
      }

      // Derive name from URL if not provided
      const themeName = name || new URL(url).searchParams.get("theme") || `Theme ${themes.length + 1}`;

      const newTheme: SavedTheme = {
        name: themeName,
        url,
        light,
        dark,
        importedAt: new Date().toISOString(),
      };

      const updated = [...themes.filter((t) => t.name !== themeName), newTheme];
      setThemes(updated);
      saveThemes(updated);

      // Apply immediately
      setActiveTheme(themeName);
      localStorage.setItem(ACTIVE_THEME_KEY, themeName);
      const isDark = document.documentElement.classList.contains("dark");
      const vars = isDark ? { ...mapToHireTrail(light), ...mapToHireTrail(dark) } : mapToHireTrail(light);
      applyVars(vars);

      return newTheme;
    } finally {
      setImporting(false);
    }
  }, [themes]);

  const applyTheme = useCallback((name: string) => {
    const theme = themes.find((t) => t.name === name);
    if (!theme) return;
    setActiveTheme(name);
    localStorage.setItem(ACTIVE_THEME_KEY, name);
    const isDark = document.documentElement.classList.contains("dark");
    const vars = isDark ? { ...mapToHireTrail(theme.light), ...mapToHireTrail(theme.dark) } : mapToHireTrail(theme.light);
    applyVars(vars);
  }, [themes]);

  const removeTheme = useCallback((name: string) => {
    const theme = themes.find((t) => t.name === name);
    if (theme) {
      clearVars(mapToHireTrail(theme.light));
      clearVars(mapToHireTrail(theme.dark));
    }
    const updated = themes.filter((t) => t.name !== name);
    setThemes(updated);
    saveThemes(updated);
    if (activeTheme === name) {
      setActiveTheme(null);
      localStorage.removeItem(ACTIVE_THEME_KEY);
    }
  }, [themes, activeTheme]);

  const resetToDefault = useCallback(() => {
    // Clear all custom vars
    for (const theme of themes) {
      clearVars(mapToHireTrail(theme.light));
      clearVars(mapToHireTrail(theme.dark));
    }
    setActiveTheme(null);
    localStorage.removeItem(ACTIVE_THEME_KEY);
  }, [themes]);

  return {
    themes,
    activeTheme,
    importing,
    importTheme,
    applyTheme,
    removeTheme,
    resetToDefault,
  };
}
