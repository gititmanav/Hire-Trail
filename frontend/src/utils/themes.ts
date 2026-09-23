/** HireTrail ships exactly two themes: Modern Minimal light and dark.
 *  (The old 42-preset tweakcn registry was removed 2026-08-05 — it was never
 *  reachable from the UI and cost ~500 KB in the main chunk. `getTheme` still
 *  accepts any legacy stored id and collapses it to light or dark.) */

export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  variables: Record<string, string>;
  darkVariables?: Record<string, string>;
}

const MODERN_MINIMAL_LIGHT: Theme = {
  id: "default",
  name: "Modern Minimal",
  isDark: false,
  variables: {
    "--background": "0 0% 100%",
    "--foreground": "0 0% 20%",
    "--card": "0 0% 100%",
    "--card-foreground": "0 0% 20%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "0 0% 20%",
    "--primary": "217 91.2% 59.8%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "220 14.4% 95.9%",
    "--secondary-foreground": "215 13.8% 34.1%",
    "--muted": "210 19.9% 98%",
    "--muted-foreground": "220 9% 46.1%",
    "--accent": "204 93.6% 93.7%",
    "--accent-foreground": "224 64.3% 32.9%",
    "--destructive": "0 84.2% 60.2%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "220 13% 91%",
    "--input": "220 13% 91%",
    "--ring": "217 91.2% 59.8%",
    "--chart-1": "217 91.2% 59.8%",
    "--chart-2": "221 83.2% 53.3%",
    "--chart-3": "224 76.3% 48%",
    "--chart-4": "226 70.7% 40.2%",
    "--chart-5": "224 64.3% 32.9%",
    "--sidebar": "210 19.9% 98%",
    "--sidebar-foreground": "0 0% 20%",
    "--sidebar-primary": "217 91.2% 59.8%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "204 93.6% 93.7%",
    "--sidebar-accent-foreground": "224 64.3% 32.9%",
    "--sidebar-border": "220 13% 91%",
    "--sidebar-ring": "217 91.2% 59.8%",
  },
};

const MODERN_MINIMAL_DARK: Theme = {
  id: "dark",
  name: "Modern Minimal Dark",
  isDark: true,
  variables: {
    "--background": "180 0% 9%",
    "--foreground": "120 0% 89.8%",
    "--card": "0 0% 14.9%",
    "--card-foreground": "120 0% 89.8%",
    "--popover": "0 0% 14.9%",
    "--popover-foreground": "120 0% 89.8%",
    "--primary": "217 91.2% 59.8%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "0 0% 14.9%",
    "--secondary-foreground": "120 0% 89.8%",
    "--muted": "0 0% 12.2%",
    "--muted-foreground": "120 0% 63.9%",
    "--accent": "224 64.3% 32.9%",
    "--accent-foreground": "213 97% 87.3%",
    "--destructive": "0 84.2% 60.2%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "0 0% 25.1%",
    "--input": "0 0% 25.1%",
    "--ring": "217 91.2% 59.8%",
    "--chart-1": "213 93.9% 67.8%",
    "--chart-2": "217 91.2% 59.8%",
    "--chart-3": "221 83.2% 53.3%",
    "--chart-4": "224 76.3% 48%",
    "--chart-5": "226 70.7% 40.2%",
    "--sidebar": "180 0% 9%",
    "--sidebar-foreground": "120 0% 89.8%",
    "--sidebar-primary": "217 91.2% 59.8%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": "224 64.3% 32.9%",
    "--sidebar-accent-foreground": "213 97% 87.3%",
    "--sidebar-border": "0 0% 25.1%",
    "--sidebar-ring": "217 91.2% 59.8%",
  },
};

export const CORE_THEMES: Theme[] = [MODERN_MINIMAL_LIGHT, MODERN_MINIMAL_DARK];

/** Legacy preset ids (removed registry) that were dark — users who had one
 *  stored land on dark rather than snapping to light. */
const LEGACY_DARK_IDS = new Set([
  "bold-tech", "catppuccin", "cosmic-night", "cyberpunk", "darkmatter",
  "doom-64", "midnight-bloom", "northern-lights", "perpetuity",
  "retro-arcade", "starry-night", "t3-chat",
]);

export function getTheme(id: string): Theme {
  if (id === "dark" || id === "modern-minimal-dark" || LEGACY_DARK_IDS.has(id)) {
    return MODERN_MINIMAL_DARK;
  }
  return MODERN_MINIMAL_LIGHT;
}
