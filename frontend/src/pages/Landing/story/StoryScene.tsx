/** The story — one pinned stage from the hero to the dive into dark. Wide
 *  screens (1024px and up); below that, story/mobile/MobileStory tells it.
 *
 *  The stage (beams, the product window, the page colour) stays put while the
 *  copy scrolls over it: the hero, then Tailor · Apply · Track. The window
 *  rises out of the hero as black turns to white, holds while each act plays
 *  inside it, then opens Settings → Personalize, turns dark, and the camera
 *  dives into the Dark theme card until the page is dark.
 *
 *  Everything moves from one scroll callback (`paint`) that writes styles to
 *  marked elements — no React state per frame. Reduced motion keeps the
 *  crossfades and drops the moves (no rise, slide, dive or travel). */
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useScene, useReducedMotion } from "../engine/hooks.ts";
import { clamp01, easeIn, easeInOut, easeOut, lerp, range, remeasure } from "../engine/scroll.ts";
import HeroBeams, { type HeroBeamsHandle } from "../hero/HeroBeams.tsx";
import ProductWindow, { SCREEN_URL, SCREENS, WINDOW_H, WINDOW_W, type ScreenName } from "./ProductWindow.tsx";
import { GAUGE_CIRC, STUDIO_BULLETS, STUDIO_KEYWORDS } from "./StudioScreen.tsx";
import { BOARDS, CHROME_STORE_URL } from "../parts.tsx";
import { boxWithin, center, collect, css, round, setState, setText, type Box, type Els } from "../engine/dom.ts";
import HeroCopy from "./HeroCopy.tsx";

/* ─── Geometry, measured on layout (never per frame) ─── */

interface Metrics {
  vw: number;
  vh: number;
  hero: number;
  acts: { top: number; h: number }[];
  zoom: { top: number; h: number };
  end: number;
  /** Window poses: scale at the hero peek, centred, and beside the copy. */
  sPeek: number;
  sCenter: number;
  sAct: number;
  yPeek: number;
  yCenter: number;
  xAct: number;
  yAct: number;
  /** Design-space targets inside the window. */
  tab: Box;
  track: Box;
  merge: Box;
  slotApplied: Box;
  slotInterview: Box;
  zoomTarget: Box;
  cardH: number;
}

/* ─── Copy ─── */

function ActCopy({ id, eyebrow, title, lede, points, children, actRef }: {
  id?: string;
  eyebrow: string;
  title: string;
  lede: string;
  points?: string[];
  children?: React.ReactNode;
  actRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div id={id} className="lp-act relative flex" style={{ height: "var(--lp-act)" }}>
      <div ref={actRef} className="lp-act-copy lp-on-light">
        <p className="lp-eyebrow text-[hsl(var(--lp-fog-light))]">{eyebrow}</p>
        <h2 className="lp-h2 mt-2 text-[hsl(var(--lp-ink))] text-balance">{title}</h2>
        <p className="lp-lede mt-5 text-[hsl(var(--lp-fog-light))] text-pretty">{lede}</p>
        {points && (
          <ul className="mt-6 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] leading-snug text-[hsl(var(--lp-ink))] font-medium">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[hsl(var(--lp-ink))] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </div>
  );
}

/* ─── The scene ─── */

export default function StoryScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const beamsRef = useRef<HeroBeamsHandle>(null);
  const beamsWrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const nightRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const heroBlockRef = useRef<HTMLDivElement>(null);
  const zoomBlockRef = useRef<HTMLDivElement>(null);
  const actBlocks = useRef<(HTMLDivElement | null)[]>([]);
  const actCopies = useRef<(HTMLDivElement | null)[]>([]);
  const toneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const els = useRef<Els>({});
  const urls = useRef<HTMLElement[]>([]);
  const metrics = useRef<Metrics | null>(null);
  const lastPx = useRef(0);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  /* Collect the window's marked parts once. */
  useLayoutEffect(() => {
    const win = windowRef.current;
    if (!win) return;
    els.current = collect(win);
    urls.current = Array.from(win.querySelectorAll<HTMLElement>('[data-lp="url"]'));
  }, []);

  const measure = useCallback(() => {
    const section = sectionRef.current;
    const win = windowRef.current;
    if (!section || !win) return;
    const vw = window.innerWidth;
    const vh = stageRef.current?.offsetHeight || window.innerHeight;
    const blockBox = (el: HTMLElement | null) => ({ top: el?.offsetTop ?? 0, h: el?.offsetHeight ?? 0 });
    const content = heroBlockRef.current?.parentElement;
    const contentTop = content?.offsetTop ?? 0;
    const hero = heroBlockRef.current?.offsetHeight ?? vh;
    const acts = actBlocks.current.map((el) => {
      const b = blockBox(el);
      return { top: b.top + contentTop, h: b.h };
    });
    const zb = blockBox(zoomBlockRef.current);
    const zoom = { top: zb.top + contentTop, h: zb.h };
    const end = section.offsetHeight - vh;

    // Centred after the rise, then beside the copy.
    const sCenter = Math.min((0.84 * vw) / WINDOW_W, (0.72 * vh) / WINDOW_H);
    const sAct = Math.min((0.54 * vw) / WINDOW_W, (0.7 * vh) / WINDOW_H);
    const xAct = vw * 0.215;
    const yAct = 0;
    const yCenter = vh * 0.035;
    const sPeek = sCenter * 0.9;
    // The window's top edge sits at ~82% of the viewport in the hero.
    const yPeek = vh * 0.82 + (WINDOW_H * sPeek) / 2 - vh / 2;

    const e = els.current;
    const board = e.board;
    // The slots' boxes, at their resting size (a resize can land mid-move).
    const cardH = (e["slot-Applied"]?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    const slotApplied = { ...boxWithin(e["slot-Applied"], board ?? win), h: cardH };
    const slotInterview = { ...boxWithin(e["slot-Interview"], board ?? win), h: cardH };

    metrics.current = {
      vw, vh, hero, acts, zoom, end,
      sPeek, sCenter, sAct, yPeek, yCenter, xAct, yAct,
      tab: boxWithin(e["ext-tab"], win),
      track: boxWithin(e["ext-track"], win),
      merge: boxWithin(e["merge-btn"], win),
      slotApplied,
      slotInterview,
      zoomTarget: boxWithin(e["zoom-target"], win),
      cardH,
    };

    // The moving card is as wide as its slot.
    css(e.flyer, { width: `${slotApplied.w}px` });

    // Header tone: dark over the hero, light over the acts, dark once the dive covers the page.
    const [dark1, light, dark2] = toneRefs.current;
    const lightFrom = hero * 0.55;
    const flip = zoom.top - vh * 0.5 + (zoom.h - vh * 0.5) * 0.3;
    css(dark1, { top: "0px", height: `${lightFrom}px` });
    css(light, { top: `${lightFrom}px`, height: `${Math.max(0, flip - lightFrom)}px` });
    css(dark2, { top: `${flip}px`, height: `${Math.max(0, section.offsetHeight - flip)}px` });
    remeasure();
  }, []);

  const paint = useCallback((px: number) => {
    lastPx.current = px;
    const m = metrics.current;
    const win = windowRef.current;
    const stage = stageRef.current;
    if (!m || !win || !stage) return;
    const e = els.current;
    const still = reducedRef.current;
    const { vh, hero } = m;

    // Act progress: 0 when an act's block top reaches mid-viewport, 1 when its bottom does.
    const act = (i: number) => range(px, m.acts[i].top - vh * 0.5, m.acts[i].top + m.acts[i].h - vh * 0.5);
    const a1 = act(0);
    const a2 = act(1);
    const a3 = act(2);
    const z = range(px, m.zoom.top - vh * 0.5, m.end);

    /* Page colour: black → white as the window rises, white → night on the dive. */
    const white = range(px, hero * 0.28, hero * 0.92);
    const toNight = easeInOut(range(z, 0.24, 0.36));
    const level = Math.round(lerp(lerp(0, 255, white), 10, toNight));
    css(stage, { backgroundColor: `rgb(${level}, ${level}, ${level})` });

    /* Beams and glow fade as the page turns white; the beams stop once gone. */
    const beams = 1 - range(px, hero * 0.18, hero * 0.78);
    css(beamsWrapRef.current, { opacity: round(beams) });
    beamsRef.current?.setActive(beams > 0.001);
    css(glowRef.current, { opacity: round(1 - range(px, hero * 0.3, hero * 0.9)) });
    css(win, { "--lp-window-rim": round(0.22 * (1 - white)) });

    /* Hero copy drifts up slower than the page and fades. */
    if (heroCopyRef.current) {
      css(heroCopyRef.current, {
        opacity: round(1 - range(px, hero * 0.06, hero * 0.5)),
        transform: still ? "none" : `translate3d(0, ${round(px * 0.28, 1)}px, 0)`,
      });
    }

    /* Window pose. The window steps aside for the copy. */
    const slideT = range(px, hero * 0.98, hero * 0.98 + vh * 0.42);
    let x = 0;
    let y = 0;
    let s = m.sAct;
    let tilt = 0;
    if (still) {
      x = m.xAct;
      y = m.yAct;
    } else {
      // Rise to the centre as the hero copy leaves, hold a beat, then step
      // aside for the copy (desktop) — the first act's copy fades in meanwhile.
      const rise = easeOut(range(px, 0, hero * 0.92));
      const slide = easeInOut(slideT);
      const sRise = lerp(m.sPeek, m.sCenter, rise);
      const yRise = lerp(m.yPeek, m.yCenter, rise);
      s = lerp(sRise, m.sAct, slide);
      x = lerp(0, m.xAct, slide);
      y = lerp(yRise, m.yAct, slide);
      tilt = lerp(24, 0, easeOut(range(px, 0, hero * 0.9)));
    }

    /* The dive: the Dark card's centre travels to mid-screen as the camera zooms in. */
    const dive = range(z, 0.36, 0.96);
    let k = 1;
    if (!still && dive > 0) {
      const t = m.zoomTarget;
      const c = center(t);
      const cx = c.x - WINDOW_W / 2;
      const cy = c.y - WINDOW_H / 2;
      const cover = Math.max(m.vw / (t.w * s), m.vh / (t.h * s)) * 1.18;
      k = Math.exp(Math.log(cover) * easeIn(dive));
      const travel = easeInOut(clamp01(dive * 1.6));
      const dx = (x + cx * s) * (1 - travel);
      const dy = (y + cy * s) * (1 - travel);
      x = dx - cx * s * k;
      y = dy - cy * s * k;
    }
    css(win, {
      transform: `translate3d(${round(x, 1)}px, ${round(y, 1)}px, 0) perspective(2200px) rotateX(${round(tilt, 2)}deg) scale(${round(s * k, 4)})`,
      willChange: px > 0 && (px < hero * 1.5 || dive > 0) ? "transform" : "auto",
      // Reduced motion: no rise — the window simply appears once the hero copy has gone.
      opacity: still ? round(range(px, hero * 0.45, hero * 0.85)) : 1,
    });
    // The light the window is lit from sits under it.
    css(glowRef.current, { transform: `translate3d(${round(x, 1)}px, ${round(y, 1)}px, 0) scale(${round(s, 4)})` });
    css(nightRef.current, { opacity: round(still ? range(z, 0.5, 0.95) : range(z, 0.82, 1)) });

    /* Screens: crossfade across each act boundary. */
    const edge = (i: number) => m.acts[i].top - vh * 0.5;
    const fade = vh * 0.1;
    const across = (at: number) => range(px, at - fade, at + fade);
    const toPosting = across(edge(1));
    const toBoard = across(edge(2));
    const toSettings = range(z, 0.04, 0.2);
    const toDark = range(z, 0.22, 0.34);
    const visible: Record<ScreenName, number> = {
      studio: 1 - toPosting,
      posting: toPosting * (1 - toBoard),
      board: toBoard * (1 - toSettings),
      settings: toSettings * (1 - toDark),
      settingsDark: toDark,
    };
    let top: ScreenName = "studio";
    for (const name of SCREENS) {
      const o = visible[name];
      const el = e[`screen-${name}`];
      if (!el) continue;
      if (o > visible[top]) top = name;
      el.classList.toggle("is-live", o > 0.001);
      css(el, { opacity: round(o) });
    }
    for (const u of urls.current) setText(u, SCREEN_URL[top]);
    css(e["bar-dark"], { opacity: round(toDark) });

    /* Act 1 — Studio. */
    STUDIO_KEYWORDS.forEach((_, i) => css(e[`kw-${i}`], { "--lp-on": round(range(a1, 0.12 + i * 0.045, 0.18 + i * 0.045)) }));
    const step = a1 < 0.38 ? 0 : a1 < 0.52 ? 1 : 2;
    [0, 1, 2].forEach((i) => setState(e[`step-${i}`], i < step ? "done" : i === step ? "active" : "todo"));
    [2, 3, 4].forEach((i, n) => {
      const on = range(a1, 0.4 + n * 0.035, 0.46 + n * 0.035);
      css(e[`chip-${i}-on`], { opacity: round(on) });
      css(e[`chip-${i}-off`], { opacity: round(1 - on) });
    });
    STUDIO_BULLETS.forEach((_, i) => {
      const r = easeOut(range(a1, 0.54 + i * 0.085, 0.63 + i * 0.085));
      css(e[`b${i}-old`], { opacity: round(1 - r) });
      css(e[`b${i}-new`], { opacity: round(r) });
      css(e[`b${i}-mark`], { "--lp-mark": round(r) });
    });
    const score = lerp(6.4, 8.7, easeInOut(range(a1, 0.56, 0.84)));
    const excellent = score >= 7.5;
    const scoreColor = excellent ? "rgb(var(--palette-emerald-500))" : "rgb(var(--palette-amber-500))";
    css(e["gauge-ring"], { strokeDashoffset: round(GAUGE_CIRC * (1 - score / 10), 2), stroke: scoreColor });
    setText(e["gauge-num"], score.toFixed(1));
    setText(e["gauge-label"], excellent ? "Excellent" : "Good");
    css(e["gauge-label"], { color: scoreColor });

    /* Act 2 — the extension. */
    const ring = range(a2, 0.06, 0.16) * (1 - range(a2, 0.3, 0.36));
    css(e["ext-tab-ring"], { opacity: round(ring), transform: `scale(${round(1 + 0.08 * ring, 3)})` });
    const open = easeOut(range(a2, 0.32, 0.44));
    css(e["ext-panel"], {
      opacity: round(open),
      transform: `translate3d(${round((1 - open) * 14, 1)}px, 0, 0) scale(${round(0.97 + 0.03 * open, 4)})`,
      transformOrigin: "100% 0%",
    });
    const detected = easeOut(range(a2, 0.44, 0.54));
    css(e["ext-detected"], { opacity: round(detected), transform: `translate3d(0, ${round((1 - detected) * 6, 1)}px, 0)` });
    const pressTrack = a2 > 0.64 && a2 < 0.74;
    css(e["ext-track"], { backgroundColor: pressTrack ? "rgba(15, 23, 42, 0.06)" : "transparent" });
    const tracked = easeOut(range(a2, 0.7, 0.78));
    css(e["ext-status"], { opacity: round(tracked), transform: `translate3d(0, ${round((1 - tracked) * 8, 1)}px, 0)` });

    /* Act 3 — the inbox, the merge, the move. */
    const reviewIn = easeOut(range(a3, 0.1, 0.24));
    const reviewOut = range(a3, 0.5, 0.58);
    css(e.review, {
      opacity: round(reviewIn * (1 - reviewOut)),
      transform: `translate3d(0, ${round((1 - reviewIn) * 18 + reviewOut * 10, 1)}px, 0)`,
    });
    const pressMerge = a3 > 0.42 && a3 < 0.5;
    css(e["merge-btn"], { backgroundColor: pressMerge ? "rgb(var(--palette-amber-100))" : "" });
    const lift = range(a3, 0.5, 0.56) * (1 - range(a3, 0.78, 0.84));
    const move = still ? (a3 >= 0.66 ? 1 : 0) : easeInOut(range(a3, 0.54, 0.78));
    const from = m.slotApplied;
    const to = m.slotInterview;
    css(e.flyer, {
      transform: `translate3d(${round(lerp(from.x, to.x, move), 1)}px, ${round(lerp(from.y, to.y, move), 1)}px, 0)`,
      opacity: still ? round(1 - Math.min(range(a3, 0.6, 0.66), 1 - range(a3, 0.66, 0.72))) : 1,
    });
    css(e["flyer-card"], {
      transform: `scale(${round(1 + 0.035 * lift, 4)})`,
      boxShadow: lift > 0 ? `0 ${round(18 * lift)}px ${round(40 * lift)}px -12px rgb(0 0 0 / ${round(0.28 * lift)}), 0 0 0 ${round(2 * lift, 2)}px hsl(var(--ring) / 0.15)` : "none",
    });
    css(e["flyer-stripe"], { opacity: round(range(a3, 0.6, 0.72)) });
    css(e["slot-Applied"], { height: `${round(m.cardH * (1 - easeInOut(range(a3, 0.56, 0.72))), 1)}px` });
    css(e["slot-Interview"], { height: `${round(m.cardH * easeInOut(range(a3, 0.62, 0.78)), 1)}px` });
    setText(e["count-Applied"], a3 >= 0.62 ? "7" : "8");
    setText(e["count-Interview"], a3 >= 0.74 ? "3" : "2");
    const toast = easeOut(range(a3, 0.8, 0.86)) * (1 - range(a3, 0.95, 1));
    css(e.toast, { opacity: round(toast), transform: `translate3d(-50%, ${round((1 - toast) * -8, 1)}px, 0)` });

    /* The pointer: to the tab, the Track row, then the Merge button. */
    const pointer = e.cursor;
    if (pointer) {
      let px2 = 0;
      let py2 = 0;
      let show = 0;
      let press = 0;
      const tab = center(m.tab);
      const track = center(m.track);
      const merge = center(m.merge);
      if (!still && a2 > 0.12 && a2 < 0.9 && visible.posting > 0.5) {
        const startX = 700;
        const startY = 560;
        const toTab = easeInOut(range(a2, 0.14, 0.3));
        const toTrack = easeInOut(range(a2, 0.46, 0.62));
        px2 = lerp(lerp(startX, tab.x, toTab), track.x, toTrack);
        py2 = lerp(lerp(startY, tab.y, toTab), track.y, toTrack);
        show = range(a2, 0.12, 0.18) * (1 - range(a2, 0.8, 0.88));
        press = (a2 > 0.3 && a2 < 0.34) || (a2 > 0.64 && a2 < 0.68) ? 1 : 0;
      } else if (!still && a3 > 0.2 && a3 < 0.62 && visible.board > 0.5) {
        const startX = 860;
        const startY = 700;
        const toMerge = easeInOut(range(a3, 0.24, 0.4));
        px2 = lerp(startX, merge.x, toMerge);
        py2 = lerp(startY, merge.y, toMerge);
        show = range(a3, 0.2, 0.26) * (1 - range(a3, 0.52, 0.6));
        press = a3 > 0.42 && a3 < 0.46 ? 1 : 0;
      }
      css(pointer, {
        opacity: round(show),
        transform: `translate3d(${round(px2 - 4, 1)}px, ${round(py2 - 3, 1)}px, 0) scale(${press ? 0.86 : 1})`,
      });
    }

    /* The copy beside the window: each act is fully there while it's centred. */
    actCopies.current.forEach((el, i) => {
      if (!el) return;
      const b = m.acts[i];
      const d = Math.abs(b.top + b.h / 2 - (px + vh / 2)) / vh;
      // The first act waits until the window has made room for it.
      const room = i === 0 && !still ? range(slideT, 0.55, 1) : 1;
      css(el, { opacity: round(Math.min(room, 1 - clamp01((d - 0.26) / 0.22))) });
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    paint(lastPx.current);
    const ro = new ResizeObserver(() => {
      measure();
      paint(lastPx.current);
    });
    if (sectionRef.current) ro.observe(sectionRef.current);
    document.fonts?.ready.then(() => { measure(); paint(lastPx.current); }).catch(() => {});
    return () => ro.disconnect();
  }, [measure, paint]);

  useScene(sectionRef, "pin", (_p, px) => paint(px), stageRef);

  // Repaint once the motion preference changes.
  useEffect(() => {
    measure();
    paint(lastPx.current);
  }, [reduced, measure, paint]);

  const setAct = (i: number) => (el: HTMLDivElement | null) => { actBlocks.current[i] = el; };
  const setCopy = (i: number) => (el: HTMLDivElement | null) => { actCopies.current[i] = el; };
  const setTone = (i: number) => (el: HTMLDivElement | null) => { toneRefs.current[i] = el; };

  return (
    <section ref={sectionRef} className="lp-story relative" aria-label="How HireTrail works">
      <div ref={setTone(0)} data-lp-tone="dark" className="absolute inset-x-0 pointer-events-none" />
      <div ref={setTone(1)} data-lp-tone="light" className="absolute inset-x-0 pointer-events-none" />
      <div ref={setTone(2)} data-lp-tone="dark" className="absolute inset-x-0 pointer-events-none" />

      <div ref={stageRef} className="sticky top-0 h-screen h-svh overflow-hidden" style={{ backgroundColor: "#000" } as CSSProperties}>
        <div ref={beamsWrapRef} className="absolute inset-0">
          <HeroBeams ref={beamsRef} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
          <div className="lp-spotlight is-on" style={{ ["--lp-spot-x" as string]: "-8%", ["--lp-spot-y" as string]: "-6%", ["--lp-spot-angle" as string]: "34deg", ["--lp-spot-strength" as string]: "0.55" }} />
        </div>
        <div ref={glowRef} className="lp-window-glow" />
        <ProductWindow ref={windowRef} />
        <div ref={nightRef} className="absolute inset-0 bg-[hsl(var(--lp-night))] pointer-events-none" style={{ opacity: 0 }} />
      </div>

      <div className="relative z-10 -mt-[100vh] -mt-[100svh]">
        <div ref={heroBlockRef}><HeroCopy copyRef={heroCopyRef} /></div>
        <div style={{ height: "var(--lp-gap)" }} />
        <div ref={setAct(0)}>
          <ActCopy
            id="features"
            actRef={setCopy(0)}
            eyebrow="Tailor"
            title="A resume that fits every job."
            lede="Paste a job description. HireTrail finds what the role asks for, then rewrites your bullets in its language — from your real experience."
            points={["Never invents an employer, a title or a date.", "A match score out of ten — the same answer every time.", "The preview is the PDF you send."]}
          />
        </div>
        <div ref={setAct(1)}>
          <ActCopy
            actRef={setCopy(1)}
            eyebrow="Apply"
            title="One click on six job boards."
            lede="The extension saves the job with the company and role already filled in. Hit Apply, and HireTrail tracks it for you."
          >
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              {BOARDS.map((b) => (
                <span key={b.name} className="inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--lp-fog-light))]">
                  <img src={b.src} alt="" className="w-4 h-4 object-contain grayscale opacity-70" loading="lazy" />
                  {b.name}
                </span>
              ))}
            </div>
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="lp-link mt-8 text-[15px] text-[hsl(var(--lp-ink))]">
              Add to Chrome <ArrowRight size={15} strokeWidth={2.2} />
            </a>
          </ActCopy>
        </div>
        <div ref={setAct(2)}>
          <ActCopy
            actRef={setCopy(2)}
            eyebrow="Track"
            title="Replies move the board."
            lede="Scan your Gmail and HireTrail finds the interview invites, offers and rejections, and matches each one to its application. Confirm, and the card moves."
            points={["Read-only access — it can never send, edit or delete an email.", "List, Board or Calendar: one pipeline, three ways."]}
          />
        </div>
        <div ref={zoomBlockRef} style={{ height: "var(--lp-zoom)" }} />
      </div>
    </section>
  );
}
