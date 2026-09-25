// Property test for the Custom theme engine (utils/theme.ts) — run with
//   node --test src/utils/theme.test.ts
// Node runs the TypeScript directly, so this exercises the real module. Every
// contrast is measured on the emitted CSS values, parsed back the way the
// browser reads them — nothing is trusted from the engine's internals.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  contrast, generateTheme, hexToLch, hexToRgb8, hslTriplet, lchToHex, oklchOf, paint, readableOn, rgb8ToHex, seedCustomTheme,
  themeFromClipboard, themeToClipboard, THEME_TOKEN_KEYS, type Rgb8,
} from "./theme.ts";
import { NEUTRAL_FAMILIES, PALETTE_SHADES, TAILWIND_PALETTE, type PaletteFamily } from "./tailwindPalette.ts";
import type { CustomTheme, Lch } from "./preferences.ts";

/* ─── Reading tokens back like the browser ─── */

function hslToRgb8(triplet: string): Rgb8 {
  const m = /^(-?[\d.]+) ([\d.]+)% ([\d.]+)%$/.exec(triplet);
  assert.ok(m, `not an HSL triplet: "${triplet}"`);
  const h = +m[1], s = +m[2] / 100, l = +m[3] / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb8;
}

function rgbTripletToRgb8(triplet: string): Rgb8 {
  const parts = triplet.split(" ").map(Number);
  assert.ok(parts.length === 3 && parts.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `not an RGB triplet: "${triplet}"`);
  return parts as Rgb8;
}

const over = (a: Rgb8, b: Rgb8, alpha: number): Rgb8 =>
  [0, 1, 2].map((i) => Math.round(a[i] * alpha + b[i] * (1 - alpha))) as Rgb8;

const BLACK: Rgb8 = [0, 0, 0];
const WHITE: Rgb8 = [255, 255, 255];

/* ─── Themes to check: fixed edge cases + seeded random ones ─── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EDGE_COLORS = ["#ffffff", "#000000", "#808080", "#767676", "#171717", "#f5f5f5", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#00ffff", "#ff00ff", "#3b82f6", "#f59e0b", "#fef08a", "#1e1b4b", "#7c2d12", "#ecfccb"];
const EDGE_CONTRASTS = [0, 30, 100];

function themes(): CustomTheme[] {
  const out: CustomTheme[] = [];
  for (const b of EDGE_COLORS) for (const a of EDGE_COLORS) for (const contrast of EDGE_CONTRASTS) {
    out.push({ base: hexToLch(b), accent: hexToLch(a), contrast });
  }
  // The band edges themselves, in CIELCH lightness around OKLCH 0.32 / 0.80.
  for (const L of [0, 5, 20, 24, 25, 26, 50, 72, 73, 74, 75, 90, 100]) {
    for (const contrast of EDGE_CONTRASTS) out.push({ base: [L, 0, 0], accent: [55, 70, 280], contrast });
  }
  const rand = mulberry32(0x5eed);
  const lch = (): Lch => [rand() * 100, rand() * 150, rand() * 360];
  for (let i = 0; i < 4000; i++) out.push({ base: lch(), accent: lch(), contrast: rand() * 100 });
  return out;
}

/* ─── The guarantees ─── */

const SURFACES = ["--background", "--card", "--popover", "--sidebar", "--muted", "--secondary", "--control"];
const STATUS = ["--destructive", "--success", "--warning", "--danger"];

type Failure = { theme: string; check: string; ratio: number };

function check(theme: CustomTheme, failures: Failure[]) {
  const g = generateTheme(theme);
  const t = g.tokens;
  const label = themeToClipboard(theme);
  const hsl = (name: string) => {
    assert.ok(name in t, `${name} missing for ${label}`);
    return hslToRgb8(t[name]);
  };
  const rgb = (name: string) => {
    assert.ok(name in t, `${name} missing for ${label}`);
    return rgbTripletToRgb8(t[name]);
  };
  const need = (checkName: string, fg: Rgb8, bgs: Rgb8[], min: number) => {
    for (const bg of bgs) {
      const ratio = contrast(fg, bg);
      if (ratio < min) failures.push({ theme: label, check: checkName, ratio: +ratio.toFixed(3) });
    }
  };
  const surfaces = SURFACES.map(hsl);
  const bg = hsl("--background");
  // 7:1, or — on a mid-tone background — the most black or white can reach there.
  const reachable = Math.max(contrast(BLACK, bg), contrast(WHITE, bg));
  const textTarget = Math.min(7, reachable) - 1e-9;

  need("foreground ≥ 7 (or the reachable max)", hsl("--foreground"), [...surfaces, hsl("--accent")], textTarget);
  for (const name of ["--card-foreground", "--popover-foreground", "--sidebar-foreground", "--secondary-foreground"]) {
    need(`${name} ≥ 7 (or the reachable max)`, hsl(name), surfaces, textTarget);
  }
  need("muted-foreground ≥ 4.5", hsl("--muted-foreground"), surfaces, 4.5);
  need("brand-text ≥ 4.5", hsl("--brand-text"), surfaces, 4.5);
  need("ring ≥ 3", hsl("--ring"), surfaces, 3);
  need("accent-foreground ≥ 7 (or the reachable max)", hsl("--accent-foreground"), [hsl("--accent")], textTarget);
  need("sidebar-accent-foreground ≥ 7 (or the reachable max)", hsl("--sidebar-accent-foreground"), [hsl("--sidebar-accent"), hsl("--sidebar")], textTarget);
  need("primary-foreground ≥ 3", hsl("--primary-foreground"), [hsl("--primary")], 3);
  need("sidebar-primary-foreground ≥ 3", hsl("--sidebar-primary-foreground"), [hsl("--sidebar-primary")], 3);
  for (const name of STATUS) {
    need(`${name} text ≥ 4.5`, hsl(name), surfaces, 4.5);
    need(`${name}-foreground ≥ 3`, hsl(`${name}-foreground`), [hsl(name)], 3);
  }
  for (const s of ["success", "warning", "danger"]) {
    need(`palette-${s} ≥ 4.5`, rgb(`--palette-${s}`), [...surfaces, rgb(`--palette-${s}-light`)], 4.5);
  }

  // Palette text shades on the theme's surfaces (and their own tints).
  for (const family of Object.keys(TAILWIND_PALETTE) as PaletteFamily[]) {
    const shade = (s: number) => rgb(`--palette-${family}-${s}`);
    const neutral = NEUTRAL_FAMILIES.includes(family);
    for (const s of PALETTE_SHADES) {
      if (!g.isDark && s >= (neutral ? 500 : 600)) {
        need(`${family}-${s} text ≥ 4.5 (light)`, shade(s), [...surfaces, shade(50), shade(100)], 4.5);
      } else if (g.isDark && s <= 400) {
        need(`${family}-${s} text ≥ 4.5 (dark)`, shade(s), [...surfaces, over(shade(900), bg, 0.3)], 4.5);
      }
    }
  }

  // The background is the picked colour — same lightness and hue (chroma is
  // capped for surfaces), for every pick, so it follows a drag everywhere.
  const [pL, pC, pH] = oklchOf(hexToRgb8(lchToHex(theme.base)));
  const [bL, , bH] = oklchOf(bg);
  if (Math.abs(pL - bL) > 0.006) failures.push({ theme: label, check: "background has the picked lightness", ratio: Math.abs(pL - bL) });
  if (pC > 0.03 && Math.abs(((pH - bH + 540) % 360) - 180) > 3) failures.push({ theme: label, check: "background has the picked hue", ratio: Math.abs(pH - bH) });
  // Text takes the side that reads better; the flag tells the truth.
  assert.equal(g.isDark, contrast(WHITE, bg) > contrast(BLACK, bg), `isDark wrong for ${label}`);
  assert.equal(g.fullContrast, reachable >= 7, `fullContrast wrong for ${label}`);
  // Hairlines are quiet (Sora's), but always a visible step from the card they outline.
  const edge = Math.abs(oklchOf(hsl("--border"))[0] - oklchOf(hsl("--card"))[0]);
  if (edge < 0.012) failures.push({ theme: label, check: "border visible against the card", ratio: edge });
  // Depth is judged in OKLab lightness (WCAG ratios can't see steps near black),
  // where the background leaves room for it.
  const depth = bL - oklchOf(hsl("--sidebar"))[0];
  const roomy = g.isDark ? bL >= 0.15 && bL <= 0.45 : bL >= 0.8;
  if (roomy && depth < 0.015) failures.push({ theme: label, check: "backdrop a visible step below the panel", ratio: depth });
  // On mid-tones the fills step away from the text, so a selection stays visible.
  if (reachable < 6) {
    for (const [fillKey, onKey] of [["--control", "--background"], ["--sidebar-accent", "--sidebar"]]) {
      const gap = Math.abs(oklchOf(hsl(fillKey))[0] - oklchOf(hsl(onKey))[0]);
      if (gap < 0.02) failures.push({ theme: label, check: `${fillKey} visible on a mid-tone`, ratio: gap });
    }
  }
  // The accent is used exactly as picked.
  assert.equal(t["--primary"], generateTheme({ ...theme, base: [100, 0, 0] }).tokens["--primary"]);

  // Nothing emitted outside the declared key set (presets clear exactly these).
  for (const k of Object.keys(t)) assert.ok(THEME_TOKEN_KEYS.includes(k), `undeclared token ${k}`);
}

test("every generated theme meets every contrast guarantee", () => {
  const failures: Failure[] = [];
  const all = themes();
  for (const theme of all) check(theme, failures);
  const byCheck = new Map<string, Failure[]>();
  for (const f of failures) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);
  const summary = [...byCheck].map(([name, fs]) => `${fs.length}× ${name} — worst ${Math.min(...fs.map((f) => f.ratio))}, e.g. ${fs[0].theme}`).join("\n");
  assert.equal(failures.length, 0, `${failures.length} failures across ${all.length} themes:\n${summary}`);
});

test("dragging the background moves every surface smoothly — only the text flips, once", () => {
  // A drag is modelled as even perceptual steps (OKLab lightness 0.004, about
  // a pixel in the picker) through real 8-bit colours; output steps are
  // measured in 8-bit channel levels. The old band snap moved ~120 at once.
  // Background, cards and backdrop never jump. State fills (hover, selected
  // pill, secondary, muted) may change sides only where the text flips.
  const STEADY = ["--background", "--card", "--popover", "--sidebar"];
  const FILLS = ["--muted", "--secondary", "--control", "--accent"];
  const levels = (a: Rgb8, b: Rgb8) => Math.max(...a.map((v, j) => Math.abs(v - b[j])));
  for (const [C, H] of [[0, 0], [0.04, 30], [0.08, 320], [0.12, 140], [0.06, 250], [0.2, 95]]) {
    for (const contrastValue of [0, 30, 100]) {
      let prev: { dark: boolean; steady: Rgb8[]; fills: Rgb8[] } | null = null;
      let flips = 0;
      for (let L = 0; L <= 1.0001; L += 0.004) {
        const base = hexToLch(rgb8ToHex(paint(L, C, H)));
        const g = generateTheme({ base, accent: [55, 60, 270], contrast: contrastValue });
        const cur = { dark: g.isDark, steady: STEADY.map((k) => hslToRgb8(g.tokens[k])), fills: FILLS.map((k) => hslToRgb8(g.tokens[k])) };
        if (prev) {
          const flipped = cur.dark !== prev.dark;
          if (flipped) flips += 1;
          const where = `at OKLab L ${L.toFixed(3)} (C ${C}, H ${H}, contrast ${contrastValue})`;
          cur.steady.forEach((c, i) => {
            const jump = levels(c, prev!.steady[i]);
            assert.ok(jump <= 8, `${STEADY[i]} jumped ${jump} levels ${where}`);
          });
          if (!flipped) cur.fills.forEach((c, i) => {
            const jump = levels(c, prev!.fills[i]);
            assert.ok(jump <= 8, `${FILLS[i]} jumped ${jump} levels ${where}`);
          });
        }
        prev = cur;
      }
      assert.ok(flips <= 1, `text flipped ${flips}× across one sweep (C ${C}, H ${H}, contrast ${contrastValue})`);
    }
  }
});

test("emitted HSL triplets paint back to the exact colour", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 50000; i++) {
    const c: Rgb8 = [0, 0, 0].map(() => Math.floor(rand() * 256)) as Rgb8;
    assert.deepEqual(hslToRgb8(hslTriplet(c)), c, `${hslTriplet(c)} ≠ ${c}`);
  }
});

test("readableOn never drops below 3:1", () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 20000; i++) {
    const fill: Rgb8 = [0, 0, 0].map(() => Math.floor(rand() * 256)) as Rgb8;
    assert.ok(contrast(readableOn(fill), fill) >= 3, `readableOn failed on ${fill}`);
  }
  // The flip itself: dark text on light fills, light text on dark ones.
  assert.ok(oklchOf(readableOn(hexToRgb8("#fef08a")))[0] < 0.3);
  assert.ok(oklchOf(readableOn(hexToRgb8("#1e1b4b")))[0] > 0.9);
});

test("the palette table matches App.css and Tailwind", () => {
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  const colors = createRequire(import.meta.url)("tailwindcss/colors") as Record<string, Record<string, string>>;
  for (const [family, hexes] of Object.entries(TAILWIND_PALETTE)) {
    PALETTE_SHADES.forEach((shade, i) => {
      const m = new RegExp(`--palette-${family}-${shade}:\\s*(\\d+) (\\d+) (\\d+);`).exec(css);
      assert.ok(m, `App.css lacks --palette-${family}-${shade}`);
      assert.deepEqual(m.slice(1).map(Number), hexToRgb8(hexes[i]), `App.css --palette-${family}-${shade}`);
      assert.equal(colors[family][shade].toLowerCase(), hexes[i], `tailwindcss/colors ${family}-${shade}`);
    });
  }
});

test("App.css presets define every token a Custom theme sets", () => {
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  for (const key of THEME_TOKEN_KEYS) assert.ok(css.includes(`${key}:`), `App.css has no preset value for ${key}`);
});

test("copy format round-trips and rejects junk", () => {
  const t = seedCustomTheme(false);
  assert.deepEqual(themeFromClipboard(themeToClipboard(t)), t);
  assert.deepEqual(themeFromClipboard('{"base":[95,3,90],"accent":[50,60,30],"contrast":130}'), { base: [95, 3, 90], accent: [50, 60, 30], contrast: 100 });
  for (const junk of ["", "nope", "{}", '{"base":[1,2],"accent":[1,2,3],"contrast":1}', '{"base":[1,2,3],"accent":[1,2,3]}']) {
    assert.equal(themeFromClipboard(junk), null, junk);
  }
});

test("the seed reproduces the presets' surfaces", () => {
  const light = generateTheme(seedCustomTheme(false));
  assert.equal(light.isDark, false);
  assert.deepEqual(hslToRgb8(light.tokens["--background"]), hexToRgb8("#fcfcfc"));
  assert.deepEqual(hslToRgb8(light.tokens["--primary"]), hexToRgb8("#262626"));
  const dark = generateTheme(seedCustomTheme(true));
  assert.equal(dark.isDark, true);
  assert.deepEqual(hslToRgb8(dark.tokens["--background"]), hexToRgb8("#171717"));
  assert.deepEqual(hslToRgb8(dark.tokens["--primary"]), hexToRgb8("#ededed"));
});
