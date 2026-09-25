/** "Make it yours" — the theme playground, on the dark after the dive.
 *
 *  The same engine the app runs (utils/theme.ts `generateTheme`) paints a
 *  live Board preview from a background, an accent and a contrast — through
 *  the app's own picker, swatches and slider. A few looks to start from; it
 *  tours them on its own until the visitor takes over (never under reduced
 *  motion). Whatever they settle on is offered to their new account. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { generateTheme, hexToLch, lchToHex, DEFAULT_CONTRAST } from "../../../utils/theme.ts";
import type { CustomTheme, ThemePrefs } from "../../../utils/preferences.ts";
import { ACCENT_SWATCHES, BACKGROUND_SWATCHES } from "../../../utils/themeSwatches.ts";
import { saveLandingTheme, setLandingThemeIntent } from "../../../utils/landingTheme.ts";
import ColorPicker from "../../../components/ui/ColorPicker.tsx";
import Slider from "../../../components/ui/Slider.tsx";
import { BrowserBar } from "../story/shell.tsx";
import BoardScreen from "../story/BoardScreen.tsx";
import { WINDOW_H, WINDOW_W } from "../story/ProductWindow.tsx";
import { useOpenAuth } from "../context.ts";
import { useReducedMotion } from "../engine/hooks.ts";

interface Look { name: string; base: string; accent: string }
const LOOKS: Look[] = [
  { name: "Dark", base: "#171717", accent: "#ededed" },
  { name: "Midnight", base: "#0f172a", accent: "#38bdf8" },
  { name: "Paper", base: "#f7f3ea", accent: "#f97316" },
  { name: "Forest", base: "#eef6f0", accent: "#16a34a" },
  { name: "Grape", base: "#1a1423", accent: "#a78bfa" },
  { name: "Charcoal", base: "#fcfcfc", accent: "#262626" },
];
/** The tour, then it rests on something that isn't the default. */
const TOUR = [1, 2, 3, 4, 1];
const TOUR_STEP_MS = 2600;

interface Pick { base: string; accent: string; contrast: number }
const fromLook = (l: Look): Pick => ({ base: l.base, accent: l.accent, contrast: DEFAULT_CONTRAST });
const toCustom = (p: Pick): CustomTheme => ({ base: hexToLch(p.base), accent: hexToLch(p.accent), contrast: p.contrast });

/** The pick as account preferences: a preset when it is one, else Custom. */
function toPrefs(p: Pick): ThemePrefs {
  if (p.contrast === DEFAULT_CONTRAST) {
    if (p.base === "#fcfcfc" && p.accent === "#262626") return { mode: "light" };
    if (p.base === "#171717" && p.accent === "#ededed") return { mode: "dark" };
  }
  return { mode: "custom", custom: toCustom(p) };
}

function Swatch({ color, selected, onClick, label, size = 22 }: { color: string; selected: boolean; onClick: () => void; label: string; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative shrink-0 rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--lp-coal))] ${
        selected ? "ring-2 ring-white ring-offset-2 ring-offset-[hsl(var(--lp-coal))]" : ""
      }`}
      style={{ width: size, height: size, background: color, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)" }}
    />
  );
}

export default function ThemeScene() {
  const openAuth = useOpenAuth();
  const reduced = useReducedMotion();
  const [pick, setPick] = useState<Pick>(() => fromLook(LOOKS[0]));
  const [live, setLive] = useState(false);
  const [touched, setTouched] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [inView, setInView] = useState(false);
  const [spotOn, setSpotOn] = useState(false);

  const theme = useMemo(() => generateTheme(toCustom(pick)), [pick]);
  const previewStyle = theme.tokens as unknown as CSSProperties;

  // The preview is the app at its design size, scaled to the column.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / WINDOW_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.intersectionRatio > 0.45);
      if (entry.isIntersecting) setSpotOn(true);
    }, { threshold: [0, 0.45, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A short tour of the looks while it's watched, until the visitor takes over.
  const tourStep = useRef(0);
  useEffect(() => {
    if (!inView || touched || reduced || tourStep.current >= TOUR.length) return;
    const id = window.setInterval(() => {
      const i = TOUR[tourStep.current];
      tourStep.current += 1;
      setPick(fromLook(LOOKS[i]));
      if (tourStep.current >= TOUR.length) window.clearInterval(id);
    }, TOUR_STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, touched, reduced]);

  // Remember what the visitor chose (not what the tour showed).
  useEffect(() => {
    if (touched) saveLandingTheme(toPrefs(pick));
  }, [pick, touched]);

  const choose = (next: Pick) => {
    setTouched(true);
    setLive(false);
    setPick(next);
  };
  const drag = (next: Pick) => {
    setTouched(true);
    setLive(true);
    setPick(next);
  };

  const lookIndex = LOOKS.findIndex((l) => l.base === pick.base && l.accent === pick.accent);
  const baseHex = lchToHex(hexToLch(pick.base));
  const accentHex = lchToHex(hexToLch(pick.accent));

  return (
    <section ref={sectionRef} className="relative bg-[hsl(var(--lp-night))] text-white overflow-hidden" data-lp-tone="dark" aria-labelledby="lp-theme-title">
      <div className="lp-grid opacity-60" />
      <div
        className={`lp-spotlight ${spotOn ? "is-on" : ""}`}
        style={{ ["--lp-spot-x" as string]: "-6%", ["--lp-spot-y" as string]: "-4%", ["--lp-spot-angle" as string]: "30deg", ["--lp-spot-strength" as string]: "0.9" }}
      />
      <div className="relative max-w-[1320px] mx-auto px-6 pt-[18vh] pb-[16vh]">
        <div className="max-w-[720px]">
          <p className="lp-eyebrow text-[hsl(var(--lp-fog-dark))]">Personalize</p>
          <h2 id="lp-theme-title" className="lp-h2 mt-2">Make it yours.</h2>
          <p className="lp-lede mt-5 text-[hsl(var(--lp-fog-dark))] max-w-[560px] text-pretty">
            Monochrome by default. Any colour you like. Pick a background and an accent — every shade is checked for readability as you go.
          </p>
        </div>

        <div className="mt-14 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-10 items-start">
          {/* The preview: the Board, painted by the engine. */}
          <div ref={frameRef} className="relative w-full" style={{ height: WINDOW_H * scale }}>
            <div
              className="absolute left-0 top-0 origin-top-left rounded-[18px] overflow-hidden shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_120px_-30px_rgb(0_0_0/0.9)]"
              style={{ width: WINDOW_W, height: WINDOW_H, transform: `scale(${scale})` }}
              aria-hidden
              ref={(n) => n?.setAttribute("inert", "")}
            >
              <div className={`lp-themed absolute inset-0 ${theme.isDark ? "dark" : ""}`} style={previewStyle} data-live={live ? "" : undefined}>
                <div className="absolute inset-0 top-11"><BoardScreen still /></div>
                <BrowserBar dark={theme.isDark} />
              </div>
            </div>
          </div>

          {/* The controls: the app's own picker, swatches and slider. */}
          <div className="lp-panel-dark theme-dark dark rounded-2xl p-5 sm:p-6">
            <p className="text-[13px] font-semibold text-white">Start from a look</p>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {LOOKS.map((look, i) => (
                <button
                  key={look.name}
                  type="button"
                  onClick={() => choose(fromLook(look))}
                  aria-pressed={i === lookIndex}
                  className="group flex flex-col items-center gap-1.5 rounded-lg focus-visible:outline-none"
                >
                  <span
                    className={`w-10 h-10 rounded-full overflow-hidden transition-transform duration-200 group-hover:scale-105 ${i === lookIndex ? "ring-2 ring-white ring-offset-2 ring-offset-[hsl(var(--lp-coal))]" : "ring-1 ring-white/15"} group-focus-visible:ring-2 group-focus-visible:ring-white`}
                    style={{ background: `linear-gradient(135deg, ${look.base} 0 55%, ${look.accent} 55% 100%)` }}
                  />
                  <span className={`text-[11px] ${i === lookIndex ? "text-white" : "text-white/55"}`}>{look.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-white">Accent</p>
                  <ColorPicker
                    label="Accent colour"
                    value={accentHex}
                    swatches={ACCENT_SWATCHES}
                    onChange={(hex) => drag({ ...pick, accent: hex })}
                    onCommit={(hex) => choose({ ...pick, accent: hex })}
                    popoverClassName="theme-dark dark"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {ACCENT_SWATCHES.map((c) => (
                    <Swatch key={c} color={c} label={`Accent ${c}`} selected={pick.accent === c} onClick={() => choose({ ...pick, accent: c })} />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-white">Background</p>
                  <ColorPicker
                    label="Background colour"
                    value={baseHex}
                    swatches={BACKGROUND_SWATCHES}
                    onChange={(hex) => drag({ ...pick, base: hex })}
                    onCommit={(hex) => choose({ ...pick, base: hex })}
                    popoverClassName="theme-dark dark"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {BACKGROUND_SWATCHES.map((c) => (
                    <Swatch key={c} color={c} label={`Background ${c}`} selected={pick.base === c} onClick={() => choose({ ...pick, base: c })} />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-white">Contrast</p>
                  <span className="text-[12px] tabular-nums text-white/55">{Math.round(pick.contrast)}</span>
                </div>
                <Slider
                  className="mt-3"
                  label="Contrast"
                  value={Math.round(pick.contrast)}
                  onChange={(n) => drag({ ...pick, contrast: n })}
                  onCommit={(n) => choose({ ...pick, contrast: n })}
                />
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setTouched(true);
                  saveLandingTheme(toPrefs(pick));
                  setLandingThemeIntent(true);
                  openAuth("register");
                }}
                className="lp-btn lp-btn--solid-dark w-full"
              >
                Start with this theme <ArrowRight size={16} strokeWidth={2.2} />
              </button>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[12px] leading-snug text-white/50">It&rsquo;ll be waiting in your new account.</p>
                <button
                  type="button"
                  onClick={() => choose(fromLook(LOOKS[5]))}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-white/60 hover:text-white rounded"
                >
                  <RotateCcw size={12} strokeWidth={2} /> Default
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
