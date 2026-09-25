/** The story on phones and tablets (below 1024px) — the desktop story's beats,
 *  staged for a narrow screen rather than shrunk from it.
 *
 *  One pinned stage: the beams, a narrow product window (the "device") and a
 *  caption slot under it. The hero's words scroll away and the device rises
 *  right behind them, exactly with the scroll, tilted back until it docks
 *  under the header as black turns to white. Then Tailor · Apply · Track play
 *  inside it while their captions hand over in the slot below — a phone has
 *  no room for copy beside a window, and copy scrolling over it would cover
 *  what it describes. Last, Settings → Personalize turns dark and the camera
 *  dives into the Dark card until the page is dark.
 *
 *  The stage is 100lvh tall and everything on it is placed inside the top
 *  100svh, so it fills the screen whether the browser's toolbars are showing
 *  or not. Content comes first in the DOM (the headline, then the captions);
 *  the two layers share one grid cell. Everything moves from one scroll
 *  callback that writes styles to marked elements — no React state per
 *  frame. Reduced motion keeps the crossfades and drops the moves. */
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion, useScene } from "../../engine/hooks.ts";
import { clamp01, easeIn, easeInOut, easeOut, lerp, range, remeasure } from "../../engine/scroll.ts";
import { boxWithin, center, collect, css, round, setState, setText, type Box, type Els } from "../../engine/dom.ts";
import HeroBeams, { type HeroBeamsHandle } from "../../hero/HeroBeams.tsx";
import HeroCopy from "../HeroCopy.tsx";
import { GAUGE_CIRC, STUDIO_BULLETS } from "../StudioScreen.tsx";
import MobileDevice, { DEVICE_H, DEVICE_W, M_SCREEN_URL, M_SCREENS, type MScreenName } from "./Device.tsx";
import { M_ROW_H } from "./screens.tsx";

const CAPTIONS = [
  {
    eyebrow: "Tailor",
    title: "A resume that fits every job.",
    lede: "Your bullets, rewritten in the posting’s language — from your real experience. It never invents an employer, a title or a date.",
  },
  {
    eyebrow: "Apply",
    title: "One click on six job boards.",
    lede: "In Chrome on your computer, the extension saves a posting with the company and role filled in — and tracks it when you apply.",
  },
  {
    eyebrow: "Track",
    title: "Replies move the board.",
    lede: "Scan your Gmail and HireTrail matches interview invites, offers and rejections to their applications. Confirm, and it moves.",
  },
];

/** Clear of the fixed header (12px inset + 48px bar + air). */
const HEADER_CLEAR = 72;
/** Wide and short (a phone on its side): the captions move beside the device. */
const LANDSCAPE = "(orientation: landscape) and (max-height: 560px)";
const MAX_SCALE = 1.3;

interface Metrics {
  vw: number;
  /** The always-visible height (100svh) and the stage's (100lvh). */
  vh: number;
  stageH: number;
  /** Where the device sits once docked: centre x, top, scale. */
  cx: number;
  top: number;
  s: number;
  /** Its top edge in the hero, and the scroll at which it docks. */
  peekTop: number;
  dock: number;
  copyBottom: number;
  /** Black → white. */
  w0: number;
  w1: number;
  /** Where each beat starts (the fourth is the dive), and their lengths. */
  beats: number[];
  beatLen: number;
  diveLen: number;
  /** Design-space targets inside the device. */
  tab: Box;
  track: Box;
  merge: Box;
  zoomTarget: Box;
  reviewH: number;
  slotApplied: number;
  slotInterview: number;
}

export default function MobileStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const beamsRef = useRef<HeroBeamsHandle>(null);
  const beamsWrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const nightRef = useRef<HTMLDivElement>(null);
  const heroBlockRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const els = useRef<Els>({});
  const urls = useRef<HTMLElement[]>([]);
  const metrics = useRef<Metrics | null>(null);
  const lastPx = useRef(0);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useLayoutEffect(() => {
    const device = deviceRef.current;
    if (!device) return;
    els.current = collect(device);
    urls.current = Array.from(device.querySelectorAll<HTMLElement>('[data-lp="m-url"]'));
  }, []);

  const measure = useCallback(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const device = deviceRef.current;
    if (!section || !stage || !device) return;
    const e = els.current;
    const vw = section.clientWidth;
    const vh = probeRef.current?.offsetHeight || window.innerHeight;
    const stageH = stage.offsetHeight || vh;

    // The device's area: under the header, above the tallest caption (or
    // beside the captions on a phone held sideways).
    const landscape = window.matchMedia(LANDSCAPE).matches;
    const slotTop = Math.min(...captionRefs.current.map((el) => (el ? el.offsetTop : vh)));
    const areaTop = HEADER_CLEAR;
    const areaBottom = landscape ? vh - 12 : slotTop - 16;
    const areaLeft = 16;
    const areaRight = landscape ? vw * 0.5 : vw - 16;
    const s = Math.max(0.3, Math.min((areaRight - areaLeft) / DEVICE_W, (areaBottom - areaTop) / DEVICE_H, MAX_SCALE));
    const top = areaTop + Math.max(0, (areaBottom - areaTop - DEVICE_H * s) / 2);
    const cx = (areaLeft + areaRight) / 2;

    // The device waits just under the hero's words (or low on the screen when
    // they are short), then rises with them.
    const copy = boxWithin(heroCopyRef.current, section);
    const copyBottom = copy.y + copy.h;
    const peekTop = Math.max(vh * 0.84, copyBottom + 28);
    const dock = Math.max(1, peekTop - top);
    const w1 = dock + vh * 0.05;
    const w0 = w1 - vh * 0.45;

    const beatLen = vh * 1.1;
    const diveLen = vh * 1.35;
    const first = dock + vh * 0.12;
    const beats = [0, 1, 2, 3].map((i) => first + i * beatLen);
    const end = beats[3] + diveLen;

    // The section is exactly as long as the story: the pin ends as the dive does.
    const heroH = heroBlockRef.current?.offsetHeight ?? vh;
    css(spacerRef.current, { height: `${Math.max(0, round(end + stageH - heroH, 1))}px` });
    css(featuresRef.current, { top: `${round(beats[0], 1)}px` });

    // The review card's open height, and the list slots at rest (a resize can land mid-move).
    const reviewH = e["m-review"]?.offsetHeight ?? 0;
    const applied = e["m-slot-applied"];
    const slotApplied = applied?.offsetTop ?? 0;
    const slotInterview = (e["m-slot-interview"]?.offsetTop ?? 0) + (M_ROW_H - (applied?.offsetHeight ?? M_ROW_H));

    metrics.current = {
      vw, vh, stageH, cx, top, s, peekTop, dock, copyBottom, w0, w1, beats, beatLen, diveLen,
      tab: boxWithin(e["m-ext-tab"], device),
      track: boxWithin(e["m-ext-track"], device),
      merge: boxWithin(e["m-merge-btn"], device),
      zoomTarget: boxWithin(e["m-zoom-target"], device),
      reviewH, slotApplied, slotInterview,
    };

    // Header tone: dark over the hero, light once the page is mostly white,
    // dark again as the dive turns it night.
    const [dark1, light, dark2] = toneRefs.current;
    const lightFrom = (w0 + w1) / 2;
    const flip = beats[3] + diveLen * 0.27;
    const total = end + stageH;
    css(dark1, { top: "0px", height: `${round(lightFrom, 1)}px` });
    css(light, { top: `${round(lightFrom, 1)}px`, height: `${round(Math.max(0, flip - lightFrom), 1)}px` });
    css(dark2, { top: `${round(flip, 1)}px`, height: `${round(Math.max(0, total - flip), 1)}px` });
    remeasure();
  }, []);

  const paint = useCallback((px: number) => {
    lastPx.current = px;
    const m = metrics.current;
    const device = deviceRef.current;
    const stage = stageRef.current;
    if (!m || !device || !stage) return;
    const e = els.current;
    const still = reducedRef.current;
    const { vw, vh, beats, beatLen } = m;

    const beat = (i: number) => range(px, beats[i], beats[i] + beatLen);
    const a1 = beat(0);
    const a2 = beat(1);
    const a3 = beat(2);
    const z = range(px, beats[3], beats[3] + m.diveLen);

    /* Page colour: black → white as the device docks, white → night on the dive. */
    const white = range(px, m.w0, m.w1);
    const toNight = easeInOut(range(z, 0.2, 0.34));
    const level = Math.round(lerp(lerp(0, 255, white), 10, toNight));
    css(stage, { backgroundColor: `rgb(${level}, ${level}, ${level})` });

    const beams = 1 - range(px, m.w0 - vh * 0.1, m.w1 - vh * 0.2);
    css(beamsWrapRef.current, { opacity: round(beams) });
    beamsRef.current?.setActive(beams > 0.001);
    css(device, { "--lp-window-rim": round(0.22 * (1 - white)) });

    /* The hero's words scroll away with the page; their last lines fade on the way out. */
    css(heroCopyRef.current, { opacity: round(1 - range(px, m.copyBottom - vh * 0.55, m.copyBottom - vh * 0.22)) });

    /* The device: follows the words up, 1:1, tilted back, and docks flat. */
    let top = m.top;
    let s = m.s;
    let tilt = 0;
    if (!still) {
      const lift = clamp01((m.dock - px) / m.dock);
      top = m.top + (m.peekTop - m.top) * lift;
      tilt = 16 * lift;
      s = m.s * (1 - 0.06 * lift);
    }
    let X = m.cx;
    let Y = top + (DEVICE_H * s) / 2;

    /* The dive: the Dark card's centre travels to mid-screen as the camera zooms in. */
    const dive = range(z, 0.34, 0.96);
    let k = 1;
    if (!still && dive > 0) {
      const c = center(m.zoomTarget);
      const ox = c.x - DEVICE_W / 2;
      const oy = c.y - DEVICE_H / 2;
      const cover = Math.max(vw / (m.zoomTarget.w * s), m.stageH / (m.zoomTarget.h * s)) * 1.18;
      k = Math.exp(Math.log(cover) * easeIn(dive));
      const travel = easeInOut(clamp01(dive * 1.6));
      const tx = lerp(X + ox * s, vw / 2, travel);
      const ty = lerp(Y + oy * s, vh / 2, travel);
      X = tx - ox * s * k;
      Y = ty - oy * s * k;
    }
    const tx = round(X - vw / 2, 1);
    const ty = round(Y - DEVICE_H / 2, 1);
    css(device, {
      transform: `translate3d(${tx}px, ${ty}px, 0) perspective(1600px) rotateX(${round(tilt, 2)}deg) scale(${round(s * k, 4)})`,
      willChange: px < m.dock * 1.2 || dive > 0 ? "transform" : "auto",
      // Reduced motion: no rise — the device appears as the page turns white.
      opacity: still ? round(white) : 1,
    });
    css(glowRef.current, {
      transform: `translate3d(${tx}px, ${ty}px, 0) scale(${round(s, 4)})`,
      opacity: round(1 - white),
    });
    css(nightRef.current, { opacity: round(still ? range(z, 0.5, 0.95) : range(z, 0.84, 1)) });

    /* Screens: each dissolves in over the one before it, which stays opaque
       until it's covered — the frame never shows through a half-faded pair. */
    const fade = vh * 0.07;
    const across = (at: number) => range(px, at - fade, at + fade);
    const into: Record<MScreenName, number> = {
      studio: 1,
      apply: across(beats[1]),
      track: across(beats[2]),
      settings: range(z, 0, 0.1),
      settingsDark: range(z, 0.18, 0.26),
    };
    const visible = {} as Record<MScreenName, number>;
    let front: MScreenName = "studio";
    M_SCREENS.forEach((name, i) => {
      const next = M_SCREENS[i + 1];
      const o = next && into[next] >= 1 ? 0 : into[name];
      visible[name] = o;
      if (o > 0.5) front = name;
      const el = e[`m-screen-${name}`];
      if (!el) return;
      el.classList.toggle("is-live", o > 0.001);
      css(el, { opacity: round(o) });
    });
    const toDark = into.settingsDark;
    for (const u of urls.current) setText(u, M_SCREEN_URL[front]);
    css(e["m-bar-dark"], { opacity: round(toDark) });

    /* Tailor — see the gap (the missing keywords glow), align (they're
       chosen), review (the bullets rewrite and the score climbs). */
    const step = a1 < 0.32 ? 0 : a1 < 0.5 ? 1 : 2;
    [0, 1, 2].forEach((i) => setState(e[`m-step-${i}`], i < step ? "done" : i === step ? "active" : "todo"));
    [2, 3, 4].forEach((i, n) => {
      const gap = range(a1, 0.08 + n * 0.04, 0.16 + n * 0.04);
      const on = range(a1, 0.34 + n * 0.04, 0.4 + n * 0.04);
      css(e[`m-chip-${i}-off`], { opacity: round(1 - on), "--lp-on": round(gap) });
      css(e[`m-chip-${i}-on`], { opacity: round(on) });
    });
    STUDIO_BULLETS.forEach((_, i) => {
      const r = easeOut(range(a1, 0.52 + i * 0.08, 0.6 + i * 0.08));
      css(e[`m-b${i}-old`], { opacity: round(1 - r) });
      css(e[`m-b${i}-new`], { opacity: round(r) });
      css(e[`m-b${i}-mark`], { "--lp-mark": round(r) });
    });
    const score = lerp(6.4, 8.7, easeInOut(range(a1, 0.54, 0.84)));
    const excellent = score >= 7.5;
    const scoreColor = excellent ? "rgb(var(--palette-emerald-500))" : "rgb(var(--palette-amber-500))";
    css(e["m-gauge-ring"], { strokeDashoffset: round(GAUGE_CIRC * (1 - score / 10), 2), stroke: scoreColor });
    setText(e["m-gauge-num"], score.toFixed(1));
    setText(e["m-gauge-label"], excellent ? "Excellent" : "Good");
    css(e["m-gauge-label"], { color: scoreColor });

    /* Apply — tap the edge tab, the panel opens on the detected job, tap Track. */
    const ring = range(a2, 0.06, 0.14) * (1 - range(a2, 0.24, 0.3));
    css(e["m-ext-tab-ring"], { opacity: round(ring), transform: `scale(${round(1 + 0.08 * ring, 3)})` });
    const open = easeOut(range(a2, 0.24, 0.36));
    css(e["m-ext-panel"], {
      opacity: round(open),
      transform: `translate3d(${round((1 - open) * 12, 1)}px, 0, 0) scale(${round(0.97 + 0.03 * open, 4)})`,
      transformOrigin: "100% 0%",
    });
    const detected = easeOut(range(a2, 0.36, 0.46));
    css(e["m-ext-detected"], { opacity: round(detected), transform: `translate3d(0, ${round((1 - detected) * 6, 1)}px, 0)` });
    css(e["m-ext-track"], { backgroundColor: a2 > 0.54 && a2 < 0.62 ? "rgba(15, 23, 42, 0.06)" : "transparent" });
    const tracked = easeOut(range(a2, 0.6, 0.7));
    css(e["m-ext-status"], { opacity: round(tracked), transform: `translate3d(0, ${round((1 - tracked) * 8, 1)}px, 0)` });

    /* Track — the inbox card opens above the list, Merge, it folds away, and
       the Stripe row moves from Applied to Interview. */
    const reviewOpen = easeInOut(range(a3, 0.04, 0.18));
    const reviewFold = easeInOut(range(a3, 0.46, 0.58));
    css(e["m-review-wrap"], { height: `${round(m.reviewH * reviewOpen * (1 - reviewFold), 1)}px` });
    css(e["m-review"], {
      opacity: round(range(a3, 0.08, 0.2) * (1 - range(a3, 0.42, 0.5))),
      transform: `translate3d(0, ${round((1 - reviewOpen) * -10, 1)}px, 0)`,
    });
    css(e["m-merge-btn"], { backgroundColor: a3 > 0.34 && a3 < 0.42 ? "rgb(var(--palette-amber-100))" : "" });
    const lift = range(a3, 0.56, 0.62) * (1 - range(a3, 0.8, 0.86));
    const move = still ? (a3 >= 0.7 ? 1 : 0) : easeInOut(range(a3, 0.6, 0.8));
    const appliedH = M_ROW_H * (1 - easeInOut(range(a3, 0.6, 0.74)));
    const interviewH = M_ROW_H * easeInOut(range(a3, 0.66, 0.8));
    css(e["m-slot-applied"], { height: `${round(appliedH, 1)}px` });
    css(e["m-slot-interview"], { height: `${round(interviewH, 1)}px` });
    const to = m.slotInterview - (M_ROW_H - appliedH);
    css(e["m-flyer"], {
      transform: `translate3d(0, ${round(lerp(m.slotApplied, to, move), 1)}px, 0)`,
      opacity: still ? round(1 - Math.min(range(a3, 0.64, 0.7), 1 - range(a3, 0.7, 0.76))) : 1,
    });
    css(e["m-flyer-row"], {
      transform: `scale(${round(1 + 0.03 * lift, 4)})`,
      boxShadow: lift > 0 ? `0 ${round(16 * lift)}px ${round(36 * lift)}px -12px rgb(0 0 0 / ${round(0.3 * lift)}), 0 0 0 ${round(2 * lift, 2)}px hsl(var(--ring) / 0.15)` : "none",
      zIndex: lift > 0 ? 1 : "",
    });
    css(e["m-flyer-stripe"], { opacity: round(range(a3, 0.64, 0.76)) });
    setText(e["m-count-applied"], a3 >= 0.66 ? "7" : "8");
    setText(e["m-count-interview"], a3 >= 0.76 ? "3" : "2");
    const toast = easeOut(range(a3, 0.8, 0.86)) * (1 - range(a3, 0.95, 1));
    css(e["m-toast"], { opacity: round(toast), transform: `translate3d(-50%, ${round((1 - toast) * -8, 1)}px, 0)` });

    /* The touch mark: on the tab, on Track, on Merge. */
    let touch = 0;
    let press = false;
    let at = center(m.tab);
    if (visible.apply > 0.5 && a2 > 0.06 && a2 < 0.3) {
      touch = range(a2, 0.08, 0.14) * (1 - range(a2, 0.24, 0.3));
      press = a2 > 0.18 && a2 < 0.24;
    } else if (visible.apply > 0.5 && a2 > 0.44 && a2 < 0.68) {
      at = center(m.track);
      touch = range(a2, 0.46, 0.52) * (1 - range(a2, 0.62, 0.68));
      press = a2 > 0.54 && a2 < 0.6;
    } else if (visible.track > 0.5 && a3 > 0.2 && a3 < 0.48) {
      at = center(m.merge);
      touch = range(a3, 0.22, 0.28) * (1 - range(a3, 0.42, 0.48));
      press = a3 > 0.34 && a3 < 0.4;
    }
    css(e["m-touch"], {
      opacity: round(still ? 0 : touch),
      transform: `translate3d(${round(at.x, 1)}px, ${round(at.y, 1)}px, 0) translate(-50%, -50%) scale(${press ? 0.82 : 1})`,
    });

    /* Captions: each rises into the slot as its beat begins and lifts away
       just before the next one arrives — one at a time, never overlapping. */
    captionRefs.current.forEach((el, i) => {
      if (!el) return;
      const inFrom = i === 0 ? m.dock - vh * 0.04 : beats[i] + vh * 0.01;
      const inTo = i === 0 ? m.dock + vh * 0.18 : beats[i] + vh * 0.16;
      const tIn = easeOut(range(px, inFrom, inTo));
      const tOut = range(px, beats[i + 1] - vh * 0.15, beats[i + 1] - vh * 0.02);
      css(el, {
        opacity: round(tIn * (1 - tOut)),
        transform: still ? "none" : `translate3d(0, ${round((1 - tIn) * 40 - easeIn(tOut) * 28, 1)}px, 0)`,
      });
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

  useEffect(() => {
    measure();
    paint(lastPx.current);
  }, [reduced, measure, paint]);

  const setTone = (i: number) => (el: HTMLDivElement | null) => { toneRefs.current[i] = el; };

  return (
    <section ref={sectionRef} className="lp-mstory" aria-label="How HireTrail works">
      <div ref={setTone(0)} data-lp-tone="dark" className="absolute inset-x-0 pointer-events-none" />
      <div ref={setTone(1)} data-lp-tone="light" className="absolute inset-x-0 pointer-events-none" />
      <div ref={setTone(2)} data-lp-tone="dark" className="absolute inset-x-0 pointer-events-none" />
      {/* "Features" lands on the first beat. */}
      <div ref={featuresRef} id="features" className="absolute inset-x-0 h-px pointer-events-none" aria-hidden />

      <div className="lp-mlayer lp-mcontent">
        <div ref={heroBlockRef}><HeroCopy copyRef={heroCopyRef} /></div>
        <div ref={spacerRef} />
      </div>

      <div className="lp-mlayer">
        <div ref={stageRef} className="lp-mstage" style={{ backgroundColor: "#000" } as CSSProperties}>
          <div ref={probeRef} className="lp-svh-probe" aria-hidden />
          <div ref={beamsWrapRef} className="absolute inset-0">
            <HeroBeams ref={beamsRef} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
            <div className="lp-spotlight is-on" style={{ ["--lp-spot-x" as string]: "-20%", ["--lp-spot-y" as string]: "-4%", ["--lp-spot-angle" as string]: "52deg", ["--lp-spot-strength" as string]: "0.5" }} />
          </div>
          <div ref={glowRef} className="lp-device-glow" />
          <MobileDevice ref={deviceRef} />
          <div className="lp-mcaptions lp-on-light">
            {CAPTIONS.map((c, i) => (
              <div key={c.eyebrow} ref={(el) => { captionRefs.current[i] = el; }} className="lp-mcaption" style={{ opacity: 0 }}>
                <p className="lp-mcaption-eyebrow text-[hsl(var(--lp-fog-light))]">{c.eyebrow}</p>
                <h2 className="lp-mcaption-title mt-1 text-[hsl(var(--lp-ink))] text-balance">{c.title}</h2>
                <p className="lp-mcaption-lede mt-2 text-[hsl(var(--lp-fog-light))] text-pretty">{c.lede}</p>
              </div>
            ))}
          </div>
          <div ref={nightRef} className="absolute inset-0 bg-[hsl(var(--lp-night))] pointer-events-none" style={{ opacity: 0 }} />
        </div>
      </div>
    </section>
  );
}
