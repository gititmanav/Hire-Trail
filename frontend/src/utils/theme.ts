/**
 * HireTrail's theme engine — Custom themes.
 *
 * A Custom theme is three inputs, stored in CIELCH (Linear's copy format):
 *   · base      [L,C,H]  the main card's colour; its hue and chroma tint every surface
 *   · accent    [L,C,H]  buttons, links, focus rings, the active nav pill
 *   · contrast  0–100    how far surfaces and text separate
 * generateTheme() turns them into every colour token App.css defines (HSL
 * triplets, so `hsl(var(--x) / a)` keeps working) plus a re-tinted Tailwind
 * palette (`--palette-*`, RGB triplets). Colours are generated in OKLCH —
 * perceptually even lightness steps — and brought into sRGB by reducing
 * chroma, never by clipping channels (clipping shifts the hue).
 *
 * The background is exactly the colour picked (chroma capped), so it follows
 * a drag everywhere; text takes whichever side — dark or light — reads better
 * on it, so the one change a drag can't avoid happens at a single point.
 * Readability is solved, not hoped for, and theme.test.ts proves it over
 * thousands of random themes:
 *   · text ≥ 7:1 on every surface text sits on — or, on a mid-tone background
 *     where no text can reach 7:1, as much as black or white can (≥ 4.58:1);
 *     the layers flatten there rather than the text going soft
 *   · quiet, brand (links, `text-primary`) and status text ≥ 4.5:1
 *   · text on a filled colour (buttons) ≥ 3:1 — readableOn()
 *   · palette text shades (`text-emerald-700`, `dark:text-red-300`) ≥ 4.5:1
 *
 * The Light and Dark presets are not generated — they are App.css's
 * hand-tuned values. Pure module: no DOM.
 */
import { normalizeCustomTheme, type CustomTheme, type Lch } from "./preferences.ts";
import { NEUTRAL_FAMILIES, PALETTE_SHADES, TAILWIND_PALETTE, type PaletteFamily } from "./tailwindPalette.ts";

type Vec3 = [number, number, number];
/** An sRGB colour with 8-bit channels — exactly what the page will paint. */
export type Rgb8 = Vec3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const round = (x: number, places: number) => +x.toFixed(places);

/* ─── Colour conversions (standard matrices: Ottosson's OKLab, sRGB/D65 CIELab) ─── */

const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function linToOklch([r, g, b]: Vec3): Lch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = deg(Math.atan2(bb, a));
  return [L, Math.hypot(a, bb), H < 0 ? H + 360 : H];
}

function oklchToLin([L, C, H]: Lch): Vec3 {
  const a = C * Math.cos(rad(H));
  const bb = C * Math.sin(rad(H));
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const Xn = 0.95047, Yn = 1, Zn = 1.08883;

function linToCieLch([r, g, b]: Vec3): Lch {
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  const H = deg(Math.atan2(bb, a));
  return [116 * fy - 16, Math.hypot(a, bb), H < 0 ? H + 360 : H];
}

function cieLchToLin([L, C, H]: Lch): Vec3 {
  const fy = (L + 16) / 116;
  const fx = fy + (C * Math.cos(rad(H))) / 500;
  const fz = fy - (C * Math.sin(rad(H))) / 200;
  const fi = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = Xn * fi(fx), Y = Yn * fi(fy), Z = Zn * fi(fz);
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

export function hexToRgb8(hex: string): Rgb8 {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgb8ToHex = (c: Rgb8) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const rgb8ToLin = (c: Rgb8): Vec3 => [srgbToLin(c[0] / 255), srgbToLin(c[1] / 255), srgbToLin(c[2] / 255)];

/** OKLCH [L 0–1, C, H°] of a painted colour. */
export const oklchOf = (c: Rgb8): Lch => linToOklch(rgb8ToLin(c));

const inGamut = (lin: Vec3) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** The most chroma sRGB can show at this lightness and hue, up to `C`. */
function fitChroma(L: number, C: number, H: number): number {
  if (L <= 0 || L >= 1) return 0;
  if (inGamut(oklchToLin([L, C, H]))) return C;
  let lo = 0, hi = C;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLin([L, mid, H]))) lo = mid; else hi = mid;
  }
  return lo;
}

/** OKLCH → the colour the page paints: same lightness and hue, with chroma
 *  reduced until it fits sRGB. */
export function paint(L: number, C: number, H: number): Rgb8 {
  // The ends are exact: no hue survives at black or white.
  if (L <= 0) return [0, 0, 0];
  if (L >= 1) return [255, 255, 255];
  const lin = oklchToLin([L, fitChroma(L, C, H), H]);
  return lin.map((v) => clamp(Math.round(linToSrgb(clamp(v, 0, 1)) * 255), 0, 255)) as Rgb8;
}

/** CIELCH → OKLCH, brought into sRGB (chroma fitted) but not yet rounded to
 *  8 bits — near black, rounding would invent a hue. */
function fittedOklch(lch: Lch): Lch {
  const [L, C, H] = cieLchToOklch(lch);
  const l = clamp(L, 0, 1);
  return [l, fitChroma(l, C, H), H];
}

const paintOklch = ([L, C, H]: Lch) => paint(L, C, H);
const cieLchToOklch = (lch: Lch): Lch => linToOklch(cieLchToLin(lch));

/** CIELCH (what a theme stores) → hex, gamut-mapped like everything else. */
export const lchToHex = (lch: Lch) => rgb8ToHex(paintOklch(cieLchToOklch(lch)));
/** Hex → CIELCH, rounded the way Linear's copy format writes it. */
export function hexToLch(hex: string): Lch {
  const [L, C, H] = linToCieLch(rgb8ToLin(hexToRgb8(hex)));
  return [round(L, 2), round(C, 2), C < 0.01 ? 0 : round(H, 2)];
}

/* ─── Contrast (WCAG 2) ─── */

const luminance = (c: Rgb8) => {
  const [r, g, b] = rgb8ToLin(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a: Rgb8, b: Rgb8): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text for a filled colour: dark on light fills (OKLCH L > 0.62), light on
 *  dark ones — never under 3:1; if the flip lands below, the other side wins
 *  when it does better (one of the two always clears 4.3:1). */
export function readableOn(fill: Rgb8): Rgb8 {
  const [L, , H] = oklchOf(fill);
  const dark = paint(0.16, 0.02, H);
  const light = paint(0.985, 0, H);
  const [first, second] = L > 0.62 ? [dark, light] : [light, dark];
  const firstRatio = contrast(first, fill);
  if (firstRatio >= 3) return first;
  return contrast(second, fill) > firstRatio ? second : first;
}

/** The least extreme lightness, walking from `L` toward `toward` (0 = black,
 *  1 = white), at which the colour reaches `min` contrast on every surface.
 *  Chroma follows the gamut at each step, so a vivid hue stays as vivid as
 *  sRGB allows. */
function solve(L: number, C: number, H: number, toward: 0 | 1, surfaces: Rgb8[], min: number): Rgb8 {
  const passes = (c: Rgb8) => surfaces.every((s) => contrast(c, s) >= min);
  const start = paint(L, C, H);
  if (passes(start)) return start;
  let bad = L;
  let good: number = toward;
  let best = paint(good, C, H);
  // The surfaces are kept inside a band where the extreme always passes
  // (proven by the test); if it ever didn't, the extreme is the best effort.
  if (!passes(best)) return best;
  for (let i = 0; i < 22; i++) {
    const mid = (bad + good) / 2;
    const c = paint(mid, C, H);
    if (passes(c)) { good = mid; best = c; } else bad = mid;
  }
  return best;
}

/** `a` laid over `b` at `alpha`, the way the browser composites. */
const over = (a: Rgb8, b: Rgb8, alpha: number): Rgb8 =>
  [0, 1, 2].map((i) => Math.round(a[i] * alpha + b[i] * (1 - alpha))) as Rgb8;

/* ─── Output formats ─── */

/** "H S% L%" — enough precision that it paints back to exactly this colour. */
export function hslTriplet([r8, g8, b8]: Rgb8): string {
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${round(h, 2)} ${round(s * 100, 3)}% ${round(l * 100, 3)}%`;
}

const rgbTriplet = (c: Rgb8) => c.join(" ");

/* ─── Generation ─── */

/** Linear's default. The tier steps are calibrated so a white (or near-black)
 *  base at this contrast lands on the presets' spacing. */
export const DEFAULT_CONTRAST = 30;

const BLACK: Rgb8 = [0, 0, 0];
const WHITE: Rgb8 = [255, 255, 255];
/** Luminance where black and white text read equally well — the flip point. */
const FLIP_Y = Math.sqrt(1.05 * 0.05) - 0.05;
/** Dark themes step their lighter layers from here at least (≈ #0a0a0a, the
 *  darkest screens tell from black): a black background still gets visible
 *  cards, and OKLab's steep first steps above black don't jolt them. */
const DARK_TIER_FLOOR = 0.13;
/** Tailwind's palette assumes these panels: white, and the Dark preset's. */
const DARK_PANEL_REF = oklchOf(hexToRgb8("#171717"))[0];

/** Hues of the fixed-meaning colours, from the presets (App.css). */
const STATUS_SEEDS = {
  destructive: "#ef4444",
  success: "#1d9e75",
  warning: "#ef9f27",
  danger: "#e24b4a",
} as const;

export interface GeneratedTheme {
  /** Every custom property to set inline on <html>. */
  tokens: Record<string, string>;
  /** The surfaces are dark — `.dark` goes on so `dark:` variants apply. */
  isDark: boolean;
  /** Text reaches the full 7:1. False on mid-tone backgrounds, where the most
   *  any text can reach is less (never under 4.58:1). */
  fullContrast: boolean;
}

/** OKLCH → the nearest surface on which `text` (black or white) still reaches
 *  `min`: lightness walks away from the text only as far as needed. */
function surfaceFor(L: number, C: number, H: number, text: Rgb8, min: number): Rgb8 {
  const start = paint(L, C, H);
  if (contrast(text, start) >= min) return start;
  let bad = L;
  let good = text[0] === 0 ? 1 : 0;
  let best = paint(good, C, H);
  for (let i = 0; i < 22; i++) {
    const mid = (bad + good) / 2;
    const col = paint(mid, C, H);
    if (contrast(text, col) >= min) { good = mid; best = col; } else bad = mid;
  }
  return best;
}

export function generateTheme(theme: CustomTheme): GeneratedTheme {
  // Work from the colours sRGB can show: CIELCH can name ones it can't.
  const [panelL, baseC, baseH] = fittedOklch(theme.base);
  const [accL, accC, accH] = fittedOklch(theme.accent);
  const c = clamp(theme.contrast, 0, 100) / 100;

  // Surfaces keep the base's hue and (capped) chroma: a yellow base makes a
  // yellow app, just not an eye-searing one.
  const panel = paint(panelL, Math.min(baseC, 0.11), baseH);
  // The chroma the other layers take. Near black a colour's hue is invisible
  // (one level of red in #010000) yet lighter layers would show it, so it
  // fades in over the darkest range.
  const sc = Math.min(baseC, 0.11) * clamp(panelL / DARK_TIER_FLOOR, 0, 1);
  const tinted = sc > 0.004;
  const isDark = contrast(WHITE, panel) > contrast(BLACK, panel);
  const light = !isDark;
  const toward: 0 | 1 = light ? 0 : 1;
  // Text aims for 7:1; a mid-tone panel caps what any text can reach, and
  // then the target is that cap.
  const extreme = light ? BLACK : WHITE;
  const textTarget = Math.min(7, contrast(extreme, panel));

  // Tier step: the presets' spacing at the default contrast; lower softens,
  // higher sharpens. Dark surfaces need bigger steps to read as different.
  const e = light ? (0.035 * (0.6 + 1.2 * c)) / 0.96 : (0.035 * (0.8 + 0.6 * c)) / 0.98;
  // A text surface never takes away from the target — near the middle the
  // layers flatten into the panel instead.
  const surface = (L: number, C = sc, H = baseH) => surfaceFor(L, C, H, extreme, textTarget);
  // Where the layers step from: the panel, or the floor under a near-black one.
  const tierL = light ? panelL : Math.max(panelL, DARK_TIER_FLOOR);
  // State fills — hovered rows, the selected pill, secondary buttons, soft
  // tints — step toward the text where there's room (the usual look) and away
  // from it on mid-tones, where toward would take contrast the text needs, so
  // a selection stays visible on any background; the fills change sides where
  // the text flips. `side` runs −1 (toward) → +1
  // (away) as the room shrinks from 12:1 to 6.5:1 (gradually, so a drag
  // glides through it); an away step is a visible 0.025–0.05.
  const room = contrast(extreme, panel);
  const side = clamp(1 - (2 * (room - 6.5)) / (12 - 6.5), -1, 1);
  const fill = (k: number, C = sc, H = baseH) => {
    const step = side > 0 ? side * clamp(k * e, 0.025, 0.05) : side * k * e;
    return surface(tierL + (light ? 1 : -1) * step, C, H);
  };

  // The backdrop steps below the panel. Light themes flatten it near the flip
  // through the text bound; dark ones fade the step out as the panel nears
  // the flip (full depth from luminance 0.09 down), so both sides meet there.
  const depth = light ? 1 : clamp((FLIP_Y - luminance(panel)) / (FLIP_Y - 0.09), 0, 1);
  const canvas = surface(panelL - (light ? 0.8 : 0.75 * depth) * e);
  const raised = light ? panel : surface(tierL + 1.9 * e);
  const muted = fill(light ? 0.45 : 1.05);
  const secondary = fill(light ? 0.85 : 1.9);
  const control = fill(light ? 1 : 3.4);
  // Hairlines are the surface, a little darker and quieter (Sora's): light
  // themes a step below the panel; dark ones just below the raised card, which
  // on a deep dark lands between backdrop and card, and on a mid-tone reads as
  // a soft darker edge rather than a pale line. Fields a touch stronger.
  const raisedL = oklchOf(raised)[0];
  const border = paint(light ? panelL - 2 * e : raisedL - 0.6 * e, Math.min(sc, 0.03), baseH);
  const input = paint(light ? panelL - 2.4 * e : raisedL - 1.1 * e, Math.min(sc, 0.045), baseH);
  // shadcn's `--accent` is the brand-tinted hover surface (and the active nav
  // pill), not the user's accent colour itself: the accent blended into the
  // base (OKLab), so a vivid accent tints it and a grey one keeps the base's hue.
  // Darker panels take more of the accent (18% on white → 45% on the Dark
  // preset's panel), smoothly, so the tint doesn't jump where the text flips.
  const t = clamp(0.18 + 0.27 * ((0.9 - panelL) / 0.7), 0.18, 0.45);
  const tintA = (1 - t) * sc * Math.cos(rad(baseH)) + t * accC * Math.cos(rad(accH));
  const tintB = (1 - t) * sc * Math.sin(rad(baseH)) + t * accC * Math.sin(rad(accH));
  const accentSurface = fill(light ? 1.3 : 4.5, Math.hypot(tintA, tintB), deg(Math.atan2(tintB, tintA)));

  const textSurfaces = [panel, raised, canvas, muted, secondary, control];
  const textC = Math.min(sc, 0.02);
  const foreground = solve(light ? 0.36 - 0.14 * c : 0.9 + 0.08 * c, textC, baseH, toward, [...textSurfaces, accentSurface], textTarget);
  const mutedForeground = solve(light ? 0.58 - 0.1 * c : 0.68 + 0.12 * c, Math.min(sc, 0.03), baseH, toward, textSurfaces, 4.5);

  const primary = paint(accL, accC, accH);
  const primaryForeground = readableOn(primary);
  const brandText = solve(accL, accC, accH, toward, textSurfaces, 4.5);
  const brandStrong = solve(light ? 0.42 : 0.87, Math.min(accC, 0.15), accH, toward, [accentSurface, panel, canvas], textTarget);

  const tokens: Record<string, string> = {};
  const set = (name: string, color: Rgb8) => { tokens[name] = hslTriplet(color); };

  set("--background", panel);
  set("--card", raised);
  set("--popover", raised);
  set("--sidebar", canvas);
  set("--muted", muted);
  set("--secondary", secondary);
  set("--control", control);
  set("--accent", accentSurface);
  set("--sidebar-accent", accentSurface);
  set("--border", border);
  set("--sidebar-border", border);
  set("--input", input);
  for (const name of ["--foreground", "--card-foreground", "--popover-foreground", "--sidebar-foreground", "--secondary-foreground"]) set(name, foreground);
  set("--muted-foreground", mutedForeground);
  set("--accent-foreground", brandStrong);
  set("--sidebar-accent-foreground", brandStrong);
  set("--primary", primary);
  set("--sidebar-primary", primary);
  set("--primary-foreground", primaryForeground);
  set("--sidebar-primary-foreground", primaryForeground);
  set("--brand-text", brandText);
  set("--ring", brandText);
  set("--sidebar-ring", brandText);

  // Fixed-meaning colours keep their hue; their text is solved per theme and
  // their soft tint sits on this theme's surfaces.
  for (const [name, seed] of Object.entries(STATUS_SEEDS)) {
    const [L, C, H] = oklchOf(hexToRgb8(seed));
    const soft = light ? fill(1.4, Math.min(C, 0.045), H) : fill(2.2, Math.min(C, 0.06), H);
    const text = solve(L, C, H, toward, [...textSurfaces, soft], 4.5);
    set(`--${name}`, text);
    set(`--${name}-foreground`, readableOn(text));
    if (name !== "destructive") {
      tokens[`--palette-${name}`] = rgbTriplet(text);
      tokens[`--palette-${name}-light`] = rgbTriplet(soft);
    }
  }

  // Charts: the accent, then four steps down its lightness.
  const top = light ? accL : Math.min(accL + 0.08, 0.85);
  const lift = Math.max(0, 0.3 - (top - 4 * 0.075));
  for (let i = 0; i < 5; i++) set(`--chart-${i + 1}`, paint(top - i * 0.075 + lift, accC, accH));

  // Light themes tint the preset shadows with the base hue; dark themes keep
  // the Dark preset's (App.css `.dark`).
  if (light) {
    const h = tinted ? round(+hslTriplet(panel).split(" ")[0], 1) : 220;
    tokens["--shadow-panel"] = `0 1px 2px hsl(${h} 20% 10% / 0.04), 0 1px 6px -1px hsl(${h} 20% 10% / 0.05)`;
    tokens["--shadow-floating"] = `0 1px 2px hsl(${h} 20% 10% / 0.04), 0 10px 32px -6px hsl(${h} 20% 10% / 0.14)`;
  }

  Object.assign(tokens, generatePalette({ light, panelL, sc, baseH, tinted, textSurfaces, panel, surface }));
  return { tokens, isDark, fullContrast: textTarget >= 7 };
}

/**
 * The Tailwind palette, re-tinted for a Custom theme by the role each shade
 * plays. Light themes: surfaces (the pale shades) move down with the panel,
 * darks barely move; text shades (600–950, greys from 500) darken until they
 * read on the theme's surfaces and their own pale tints. Dark themes: the
 * deep shades move with the panel; text shades (50–400) lighten until they
 * read. Solid mid shades are only ever darkened. Greys take the base's hue.
 * The shades used as backgrounds (50–200 light, 800–950 dark) obey the same
 * text bound as the theme's own surfaces.
 */
function generatePalette(o: {
  light: boolean; panelL: number; sc: number; baseH: number; tinted: boolean; textSurfaces: Rgb8[]; panel: Rgb8;
  surface: (L: number, C: number, H: number) => Rgb8;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [family, hexes] of Object.entries(TAILWIND_PALETTE) as [PaletteFamily, readonly string[]][]) {
    const neutral = NEUTRAL_FAMILIES.includes(family);
    const base = hexes.map((hex) => {
      const [L, C, H] = oklchOf(hexToRgb8(hex));
      const C2 = neutral && o.tinted ? Math.min(o.sc, 0.035) : C;
      const H2 = neutral && o.tinted ? o.baseH : H;
      const L2 = o.light
        ? L + (o.panelL - 1) * clamp((L - 0.35) / 0.6, 0, 1)
        : L + (o.panelL - DARK_PANEL_REF) * clamp((0.55 - L) / 0.3, 0, 1);
      return [L2, C2, H2] as Lch;
    });
    const painted = base.map(([L, C, H], i) => {
      const shade = PALETTE_SHADES[i];
      return (o.light ? shade <= 200 : shade >= 800) ? o.surface(L, C, H) : paint(L, C, H);
    });
    const i50 = 0, i100 = 1, i900 = PALETTE_SHADES.indexOf(900);
    PALETTE_SHADES.forEach((shade, i) => {
      let color = painted[i];
      const [L, C, H] = base[i];
      if (o.light && shade >= (neutral ? 500 : 600)) {
        color = solve(L, C, H, 0, [...o.textSurfaces, painted[i50], painted[i100]], 4.5);
      } else if (!o.light && shade <= 400) {
        color = solve(L, C, H, 1, [...o.textSurfaces, over(painted[i900], o.panel, 0.3)], 4.5);
      }
      out[`--palette-${family}-${shade}`] = rgbTriplet(color);
    });
  }
  return out;
}

/** Every property a Custom theme may set — cleared when a preset takes over. */
export const THEME_TOKEN_KEYS: readonly string[] = [...new Set([
  ...Object.keys(generateTheme({ base: [100, 0, 0], accent: [55, 60, 270], contrast: DEFAULT_CONTRAST }).tokens),
  ...Object.keys(generateTheme({ base: [8, 0, 0], accent: [55, 60, 270], contrast: DEFAULT_CONTRAST }).tokens),
])];

/** Where Custom starts: the preset on screen, as base/accent/contrast. */
export function seedCustomTheme(dark: boolean): CustomTheme {
  return dark
    ? { base: hexToLch("#171717"), accent: hexToLch("#ededed"), contrast: DEFAULT_CONTRAST }
    : { base: hexToLch("#fcfcfc"), accent: hexToLch("#262626"), contrast: DEFAULT_CONTRAST };
}

/** Linear's copy format: `{"base":[L,C,H],"accent":[L,C,H],"contrast":N}`. */
export function themeToClipboard(t: CustomTheme): string {
  const r = (lch: Lch) => lch.map((v) => round(v, 2));
  return JSON.stringify({ base: r(t.base), accent: r(t.accent), contrast: round(t.contrast, 2) });
}

/** A pasted theme, or null when it isn't one. */
export function themeFromClipboard(raw: string): CustomTheme | null {
  try {
    return normalizeCustomTheme(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}
