/**
 * Theme state — Settings → Personalize's System / Light / Dark / Custom.
 *
 * Where it lives: on the account (`preferences.theme`), so it follows the
 * person to every device — the server's value wins, and a brand-new device
 * never inherits whoever used it last. The demo account is shared by every
 * visitor, so its choice stays on the device. Signed-out pages always show
 * the default Light theme; Admin shows presets only (a Custom theme falls back
 * to the preset on its side).
 *
 * Painting happens during render (utils/themeDom, deduped) so the colours are
 * on the page before any child effect reads them — charts included, which
 * re-read on `revision`. Two contexts: the app-wide state changes only when a
 * choice is committed; the controls (Personalize only) add rAF-throttled
 * previews that paint straight to the DOM, so dragging a colour never
 * re-renders the app. Saves are debounced and flushed if the tab closes.
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../utils/api.ts";
import { normalizeThemePrefs, type CustomTheme, type ThemeMode, type ThemePrefs } from "../utils/preferences.ts";
import { seedCustomTheme } from "../utils/theme.ts";
import { clearBootCache, paintTheme, saveBootCache } from "../utils/themeDom.ts";
import { takeLandingTheme } from "../utils/landingTheme.ts";
import type { User } from "../types";

export const DEFAULT_THEME: ThemePrefs = { mode: "light" };
/** The demo account's choice, on this device only (LandingPage resets it). */
export const DEMO_THEME_KEY = "hiretrail-theme:demo";
/** Before 2026-09 the choice lived in localStorage: `:<userId>` per account,
 *  bare = whoever used the device last. Adopted once, then removed. */
const LEGACY_KEY = "hiretrail-theme-id";
const SAVE_DELAY_MS = 500;

export interface ThemeState {
  /** The surfaces are dark right now (Dark, System at night, a dark Custom theme). */
  dark: boolean;
  mode: ThemeMode;
  /** Moves whenever the painted colours change — canvas charts re-read tokens on it. */
  revision: number;
}

export interface ThemeControls {
  prefs: ThemePrefs;
  savedTo: "account" | "device";
  setMode: (mode: ThemeMode) => void;
  /** Paint a Custom theme on the next frame without keeping it (a drag). */
  preview: (custom: CustomTheme) => void;
  /** Drop an uncommitted preview and repaint the kept theme. */
  cancelPreview: () => void;
  /** Keep a Custom theme (a drag ended, a value was typed). */
  setCustom: (custom: CustomTheme) => void;
}

export const ThemeContext = createContext<ThemeState>({ dark: false, mode: "light", revision: 0 });
export const ThemeControlsContext = createContext<ThemeControls | null>(null);

function readDemoPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(DEMO_THEME_KEY);
    return (raw && normalizeThemePrefs(JSON.parse(raw))) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function forgetLegacy(userId: string) {
  try {
    localStorage.removeItem(`${LEGACY_KEY}:${userId}`);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem("hiretrail-theme");
  } catch { /* ignore */ }
}

/** Mounted once auth has resolved (until then the boot script's paint
 *  stands). Owns the route check, so navigating re-renders only this. */
export function ThemeProvider({ user, setUser, children }: {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { state, controls } = useThemeController({ user, setUser, restricted: pathname.startsWith("/admin") });
  return (
    <ThemeContext.Provider value={state}>
      <ThemeControlsContext.Provider value={controls}>{children}</ThemeControlsContext.Provider>
    </ThemeContext.Provider>
  );
}

function useThemeController({ user, setUser, restricted }: {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  /** An Admin page: presets only. */
  restricted: boolean;
}): { state: ThemeState; controls: ThemeControls } {
  const isDemo = user?.email === "demo@hiretrail.com";
  const userId = user?._id ?? null;
  // Read per sign-in (the demo login resets the key) and after each change.
  const [demoRevision, setDemoRevision] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demoPrefs = useMemo(() => (isDemo ? readDemoPrefs() : DEFAULT_THEME), [isDemo, userId, demoRevision]);
  const accountPrefs = normalizeThemePrefs(user?.preferences?.theme) ?? DEFAULT_THEME;
  const prefs = isDemo ? demoPrefs : accountPrefs;

  // Re-render when the OS scheme flips while System is chosen.
  const [, setOsTick] = useState(0);
  useEffect(() => {
    if (prefs.mode !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setOsTick((t) => t + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs.mode]);

  /* ─── Paint (during render; deduped) ─── */
  const previewing = useRef(false);
  const allowCustom = !!user && !restricted;
  const lastPaint = useRef({ dark: false, revision: 0 });
  if (!previewing.current) lastPaint.current = paintTheme(user ? prefs : DEFAULT_THEME, allowCustom);
  const painted = lastPaint.current;

  const prefsKey = JSON.stringify(prefs);
  const signedIn = !!user;
  useEffect(() => {
    if (signedIn) saveBootCache(prefs);
    else clearBootCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, prefsKey]);

  /* ─── Save (debounced; the account's last saved value is the rollback) ─── */
  const saved = useRef<ThemePrefs | undefined>(undefined);
  const pending = useRef<ThemePrefs | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    saved.current = normalizeThemePrefs(user?.preferences?.theme);
    pending.current = null;
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    authAPI.updatePreferences({ theme: next })
      .then(() => { saved.current = next; })
      .catch(() => {
        // The interceptor shows the error; roll back unless something newer is queued.
        if (pending.current) return;
        setUser((u) => u && { ...u, preferences: { ...u.preferences, theme: saved.current } });
      });
  }, [setUser]);

  // Leaving the tab saves early; closing it saves with a request that outlives the page.
  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    const onPageHide = () => {
      if (!pending.current) return;
      window.clearTimeout(timer.current);
      authAPI.flushPreferences({ theme: pending.current });
      pending.current = null;
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flush]);

  const commit = useCallback((next: ThemePrefs) => {
    previewing.current = false;
    if (isDemo) {
      try { localStorage.setItem(DEMO_THEME_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      setDemoRevision((r) => r + 1);
      return;
    }
    setUser((u) => u && { ...u, preferences: { ...u.preferences, theme: next } });
    pending.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [isDemo, setUser, flush]);

  // One-time: an account with no saved theme adopts the choice this browser
  // kept for *that same account* before themes moved to the server.
  useEffect(() => {
    if (!user || isDemo) return;
    if (user.preferences?.theme) { forgetLegacy(user._id); return; }
    let raw: string | null = null;
    try { raw = localStorage.getItem(`${LEGACY_KEY}:${user._id}`); } catch { /* ignore */ }
    const adopted = raw ? normalizeThemePrefs(raw) : undefined;
    if (!adopted || adopted.mode === DEFAULT_THEME.mode) { forgetLegacy(user._id); return; }
    const id = user._id;
    setUser((u) => u && { ...u, preferences: { ...u.preferences, theme: adopted } });
    authAPI.updatePreferences({ theme: adopted }).then(() => { saved.current = adopted; forgetLegacy(id); }).catch(() => { /* kept locally; retried next load */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isDemo]);

  // A theme the visitor built on the landing and signed up with (email or
  // Google) becomes the new account's theme — unless it already has one.
  // Runs after the legacy adopt above, so a fresh pick wins.
  useEffect(() => {
    if (!user || isDemo) return;
    const carried = takeLandingTheme();
    if (!carried || user.preferences?.theme) return;
    commit(carried);
    toast.success("Your theme is saved to your account.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isDemo]);

  /* ─── Actions ─── */
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const darkRef = useRef(painted.dark);
  darkRef.current = painted.dark;

  const setMode = useCallback((mode: ThemeMode) => {
    const { custom } = prefsRef.current;
    if (mode === "custom") commit({ mode, custom: custom ?? seedCustomTheme(darkRef.current) });
    else commit(custom ? { mode, custom } : { mode });
  }, [commit]);

  const frame = useRef(0);
  const latest = useRef<CustomTheme | null>(null);
  const allowCustomRef = useRef(allowCustom);
  allowCustomRef.current = allowCustom;

  const preview = useCallback((custom: CustomTheme) => {
    previewing.current = true;
    latest.current = custom;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (previewing.current && latest.current) paintTheme({ mode: "custom", custom: latest.current }, allowCustomRef.current);
    });
  }, []);

  const stopFrame = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    latest.current = null;
  };

  const cancelPreview = useCallback(() => {
    if (!previewing.current) return;
    stopFrame();
    previewing.current = false;
    paintTheme(prefsRef.current, allowCustomRef.current);
  }, []);

  const setCustom = useCallback((custom: CustomTheme) => {
    stopFrame();
    commit({ mode: "custom", custom });
  }, [commit]);

  const state = useMemo<ThemeState>(
    () => ({ dark: painted.dark, mode: prefs.mode, revision: painted.revision }),
    [painted.dark, prefs.mode, painted.revision],
  );
  const controls = useMemo<ThemeControls>(
    () => ({ prefs, savedTo: isDemo ? "device" : "account", setMode, preview, cancelPreview, setCustom }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefsKey, isDemo, setMode, preview, cancelPreview, setCustom],
  );
  return { state, controls };
}
