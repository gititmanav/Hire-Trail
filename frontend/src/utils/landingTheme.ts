/** A theme a visitor builds on the landing, carried into the account they
 *  create. Kept in sessionStorage (this tab only — it survives the Google
 *  OAuth round trip) and only adopted when the visitor was signing *up*
 *  (`intent`), by an account that has no theme of its own yet. */
import { normalizeThemePrefs, type ThemePrefs } from "./preferences.ts";

const KEY = "hiretrail-landing-theme";
/** A pick older than this is a different visit. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

interface Stored {
  prefs: ThemePrefs;
  intent: boolean;
  at: number;
}

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    const prefs = normalizeThemePrefs(v.prefs);
    if (!prefs || typeof v.at !== "number" || Date.now() - v.at > MAX_AGE_MS) return null;
    return { prefs, intent: v.intent === true, at: v.at };
  } catch {
    return null;
  }
}

function write(v: Stored | null) {
  try {
    if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable — the pick just doesn't travel */ }
}

/** Remember the visitor's pick (null forgets it). */
export function saveLandingTheme(prefs: ThemePrefs | null) {
  const current = read();
  write(prefs ? { prefs, intent: current?.intent ?? false, at: Date.now() } : null);
}

export function peekLandingTheme(): ThemePrefs | null {
  return read()?.prefs ?? null;
}

/** Signing up (email or Google) carries the pick; logging in doesn't. */
export function setLandingThemeIntent(intent: boolean) {
  const current = read();
  if (current) write({ ...current, intent });
}

/** The pick to adopt, once — cleared whether or not it's used. */
export function takeLandingTheme(): ThemePrefs | null {
  const current = read();
  write(null);
  return current?.intent ? current.prefs : null;
}
