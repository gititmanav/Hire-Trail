/** User preferences (Settings → Personalize) — the theme, the Applications
 *  list style and the header search's quick links. Saved on the user (`preferences` on /auth/me), so they follow
 *  the person across devices. `normalizePreferences` mirrors the backend's
 *  (backend/src/validators/preferences.ts) — keep the two in step. */

export type ThemeMode = "system" | "light" | "dark" | "custom";
/** CIELCH [L 0–100, C ≥ 0, H degrees] — Linear's theme copy format. */
export type Lch = [number, number, number];
export interface CustomTheme { base: Lch; accent: Lch; contrast: number }
export interface ThemePrefs { mode: ThemeMode; custom?: CustomTheme }
/** How the List view reads: Ledger (a stage-aware table), Trail (a timeline),
 *  Desk (the list beside the application). */
export type ListDesign = "ledger" | "trail" | "desk";
/** Pages the header search can pin as quick links — mirrors the backend's QUICK_LINK_IDS. */
export type QuickLinkId = "ai" | "personalize" | "board" | "list" | "resumes" | "calendar" | "notifications";
export const QUICK_LINK_IDS: readonly QuickLinkId[] = ["ai", "personalize", "board", "list", "resumes", "calendar", "notifications"];
export const QUICK_LINK_MAX = 3;
export const DEFAULT_QUICK_LINKS: readonly QuickLinkId[] = ["ai", "notifications", "calendar"];
/** Admin pages the admin header's search can pin — mirrors the backend's ADMIN_QUICK_LINK_IDS. */
export type AdminQuickLinkId = "users" | "feedback" | "bugs" | "ai" | "announcements" | "broadcasts" | "notifications" | "connectors" | "settings" | "audit";
export const ADMIN_QUICK_LINK_IDS: readonly AdminQuickLinkId[] = ["users", "feedback", "bugs", "ai", "announcements", "broadcasts", "notifications", "connectors", "settings", "audit"];
export const DEFAULT_ADMIN_QUICK_LINKS: readonly AdminQuickLinkId[] = ["users", "feedback", "bugs"];
export interface Preferences { theme?: ThemePrefs; listDesign?: ListDesign; quickLinks?: QuickLinkId[]; adminQuickLinks?: AdminQuickLinkId[] }

export const DEFAULT_LIST_DESIGN: ListDesign = "ledger";
export const LIST_DESIGNS: readonly ListDesign[] = ["ledger", "trail", "desk"];
const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark", "custom"];

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

/** A valid custom theme (clamped into range), or undefined. */
export function normalizeCustomTheme(v: unknown): CustomTheme | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const base = normalizeLch(o.base);
  const accent = normalizeLch(o.accent);
  if (!base || !accent || !finite(o.contrast)) return undefined;
  return { base, accent, contrast: clamp(o.contrast, 0, 100) };
}

/** Anything → valid theme prefs (or undefined when there's nothing usable).
 *  A legacy preset id collapses to light/dark; "custom" without a valid
 *  custom theme falls back to light. A valid custom theme is kept even while
 *  a preset is chosen, so switching back to Custom restores it. */
export function normalizeThemePrefs(v: unknown): ThemePrefs | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return { mode: LEGACY_DARK_IDS.has(v) ? "dark" : v === "system" ? "system" : "light" };
  if (typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const custom = normalizeCustomTheme(o.custom);
  let mode: ThemeMode = THEME_MODES.includes(o.mode as ThemeMode) ? (o.mode as ThemeMode) : "light";
  if (mode === "custom" && !custom) mode = "light";
  return custom ? { mode, custom } : { mode };
}

export function isListDesign(v: unknown): v is ListDesign {
  return typeof v === "string" && (LIST_DESIGNS as readonly string[]).includes(v);
}

/** A stored list design, made current: Classic and Table (before 2026-10-08)
 *  both became Ledger — the Table grown up. Anything else is "not set". */
export function normalizeListDesign(v: unknown): ListDesign | undefined {
  if (v === "classic" || v === "table") return "ledger";
  return isListDesign(v) ? v : undefined;
}

export function isQuickLinkId(v: unknown): v is QuickLinkId {
  return typeof v === "string" && (QUICK_LINK_IDS as readonly string[]).includes(v);
}

/** Known ids, each once, at most QUICK_LINK_MAX. An empty list is a choice;
 *  anything that isn't a list is "not set" (the defaults). */
export function normalizeQuickLinks(v: unknown): QuickLinkId[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter(isQuickLinkId))].slice(0, QUICK_LINK_MAX);
}

export function isAdminQuickLinkId(v: unknown): v is AdminQuickLinkId {
  return typeof v === "string" && (ADMIN_QUICK_LINK_IDS as readonly string[]).includes(v);
}

/** The admin bar's links: the same rules as `normalizeQuickLinks`. */
export function normalizeAdminQuickLinks(v: unknown): AdminQuickLinkId[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter(isAdminQuickLinkId))].slice(0, QUICK_LINK_MAX);
}

export function normalizePreferences(v: unknown): Preferences {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Preferences = {};
  const theme = normalizeThemePrefs(o.theme);
  if (theme) out.theme = theme;
  const listDesign = normalizeListDesign(o.listDesign);
  if (listDesign) out.listDesign = listDesign;
  const links = normalizeQuickLinks(o.quickLinks);
  if (links) out.quickLinks = links;
  const adminLinks = normalizeAdminQuickLinks(o.adminQuickLinks);
  if (adminLinks) out.adminQuickLinks = adminLinks;
  return out;
}
