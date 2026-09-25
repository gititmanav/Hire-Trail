/** User preferences (Settings → Personalize): the theme and the Applications
 *  list style. Writes are validated strictly (the client always sends
 *  normalized prefs); reads go through `normalizePreferences`, which coerces
 *  anything stored — legacy, partial, or malformed — into valid prefs. The
 *  frontend has the same rules in `utils/preferences.ts`; keep them in step. */
import { z } from "zod";

export const THEME_MODES = ["system", "light", "dark", "custom"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const LIST_DESIGNS = ["classic", "table"] as const;
export type ListDesign = (typeof LIST_DESIGNS)[number];

/** CIELCH [L 0–100, C ≥ 0, H degrees] — Linear's theme copy format. */
export type Lch = [number, number, number];
export interface CustomTheme { base: Lch; accent: Lch; contrast: number }
export interface ThemePrefs { mode: ThemeMode; custom?: CustomTheme }
export interface Preferences { theme?: ThemePrefs; listDesign?: ListDesign }

const lch = z.tuple([
  z.number().finite().min(0).max(100),
  z.number().finite().min(0).max(250),
  z.number().finite().min(-3600).max(3600),
]);

const customTheme = z.object({
  base: lch,
  accent: lch,
  contrast: z.number().finite().min(0).max(100),
}).strict();

const themePrefs = z.object({
  mode: z.enum(THEME_MODES),
  custom: customTheme.optional(),
}).strict();

/** Body of `preferences` on PUT /auth/profile — a partial patch. */
export const preferencesPatchSchema = z.object({
  theme: themePrefs.optional(),
  listDesign: z.enum(LIST_DESIGNS).optional(),
}).strict().refine((p) => JSON.stringify(p).length <= 2000, "Preferences are too large");

/** Theme ids the old preset registry stored, which were dark. */
const LEGACY_DARK_IDS = new Set([
  "dark", "modern-minimal-dark", "bold-tech", "catppuccin", "cosmic-night", "cyberpunk", "darkmatter",
  "doom-64", "midnight-bloom", "northern-lights", "perpetuity", "retro-arcade", "starry-night", "t3-chat",
]);

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function normalizeLch(v: unknown): Lch | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(finite)) return null;
  const [L, C, H] = v as number[];
  const r2 = (x: number) => Math.round(x * 100) / 100; // Linear's precision; no float noise stored
  return [r2(clamp(L, 0, 100)), r2(clamp(C, 0, 250)), r2(((H % 360) + 360) % 360) % 360];
}

export function normalizeCustomTheme(v: unknown): CustomTheme | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const base = normalizeLch(o.base);
  const accent = normalizeLch(o.accent);
  if (!base || !accent || !finite(o.contrast)) return undefined;
  return { base, accent, contrast: clamp(o.contrast, 0, 100) };
}

/** Anything → valid theme prefs. Missing = the default (light). A legacy
 *  preset id collapses to light/dark; custom without a valid custom theme
 *  falls back to light (the custom theme, when valid, is kept even while a
 *  preset is chosen, so switching back to Custom restores it). */
export function normalizeThemePrefs(v: unknown): ThemePrefs | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return { mode: LEGACY_DARK_IDS.has(v) ? "dark" : v === "system" ? "system" : "light" };
  if (typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const custom = normalizeCustomTheme(o.custom);
  let mode: ThemeMode = (THEME_MODES as readonly string[]).includes(o.mode as string) ? (o.mode as ThemeMode) : "light";
  if (mode === "custom" && !custom) mode = "light";
  return custom ? { mode, custom } : { mode };
}

export function normalizePreferences(v: unknown): Preferences {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Preferences = {};
  const theme = normalizeThemePrefs(o.theme);
  if (theme) out.theme = theme;
  if ((LIST_DESIGNS as readonly string[]).includes(o.listDesign as string)) out.listDesign = o.listDesign as ListDesign;
  return out;
}
