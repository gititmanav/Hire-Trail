/** Painting a theme onto <html> — the one place that does it.
 *
 *  Presets are App.css's `:root` / `.dark`; a theme only toggles `.dark`.
 *  A Custom theme also writes every generated token inline on <html> (inline
 *  beats the stylesheet), and a preset clears exactly those again. Repeated
 *  calls with the same theme are free (deduped), so callers can paint on
 *  every render. The boot cache lets index.html paint the right theme before
 *  any script loads (no flash of the wrong colours). */
import { generateTheme, THEME_TOKEN_KEYS, type GeneratedTheme } from "./theme.ts";
import type { CustomTheme, ThemePrefs } from "./preferences.ts";

/** Read by the inline script in index.html — keep the shape in step. */
export const BOOT_KEY = "hiretrail-theme-boot";

interface BootCache {
  /** "system" resolves the OS scheme at boot; otherwise `dark` decides. */
  mode: ThemePrefs["mode"];
  dark: boolean;
  tokens: Record<string, string> | null;
  meta: string;
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

let memo: { key: string; theme: GeneratedTheme } | null = null;
/** generateTheme, remembered for the last theme (a drag repaints it per frame). */
export function generated(custom: CustomTheme): GeneratedTheme {
  const key = JSON.stringify(custom);
  if (memo?.key !== key) memo = { key, theme: generateTheme(custom) };
  return memo.theme;
}

/** What actually gets painted: `custom` only where it's allowed (Admin and
 *  the signed-out pages show presets — a Custom theme falls back to the
 *  preset on its own side, light or dark). */
function resolve(prefs: ThemePrefs, allowCustom: boolean): { custom: CustomTheme | null; dark: boolean } {
  if (prefs.mode === "custom" && prefs.custom) {
    const dark = generated(prefs.custom).isDark;
    return allowCustom ? { custom: prefs.custom, dark } : { custom: null, dark };
  }
  return { custom: null, dark: prefs.mode === "dark" || (prefs.mode === "system" && systemPrefersDark()) };
}

/** Theme swaps repaint in one frame: transitions (hover colours etc.) are
 *  suspended until the new values are committed (`html.theme-transitioning`,
 *  App.css). Overlapping swaps — a drag — keep them suspended until the last
 *  one lands. */
let suspendToken = 0;
function withTransitionsSuspended(swap: () => void) {
  const root = document.documentElement;
  const token = ++suspendToken;
  root.classList.add("theme-transitioning");
  swap();
  void root.offsetWidth; // commit the new colours while transitions are off
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token === suspendToken) root.classList.remove("theme-transitioning");
  }));
}

function sidebarColor(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--sidebar").trim();
  return v ? `hsl(${v})` : "";
}

let lastPainted = "";
let paints = 0;

/** Paint `prefs` (deduped). Returns whether the surfaces are dark and a
 *  counter that moves whenever colours change — canvas charts key on it. */
export function paintTheme(prefs: ThemePrefs, allowCustom: boolean): { dark: boolean; revision: number } {
  const { custom, dark } = resolve(prefs, allowCustom);
  const key = JSON.stringify([custom, dark]);
  if (key === lastPainted || typeof document === "undefined") return { dark, revision: paints };
  lastPainted = key;
  paints += 1;
  const root = document.documentElement;
  withTransitionsSuspended(() => {
    const tokens = custom ? generated(custom).tokens : null;
    for (const k of THEME_TOKEN_KEYS) if (!tokens || !(k in tokens)) root.style.removeProperty(k);
    if (tokens) for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
    root.classList.toggle("dark", dark);
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = sidebarColor();
  if (meta && color) meta.setAttribute("content", color);
  return { dark, revision: paints };
}

/** Remember the signed-in user's theme for the next page load. Stores the
 *  unrestricted theme (a Custom theme even while Admin shows a preset) —
 *  most loads land in the app. */
export function saveBootCache(prefs: ThemePrefs) {
  try {
    const { custom, dark } = resolve(prefs, true);
    const theme = custom ? generated(custom) : null;
    // A preset's backdrop colour lives in App.css — read it off the page when
    // that's what is painted (Admin may be showing something else).
    const painted = lastPainted === JSON.stringify([custom, dark]);
    const cache: BootCache = {
      mode: prefs.mode,
      dark,
      tokens: theme ? theme.tokens : null,
      meta: theme ? `hsl(${theme.tokens["--sidebar"]})` : painted ? sidebarColor() : "",
    };
    localStorage.setItem(BOOT_KEY, JSON.stringify(cache));
  } catch { /* private mode / quota — the app still paints after load */ }
}

export function clearBootCache() {
  try { localStorage.removeItem(BOOT_KEY); } catch { /* ignore */ }
}
