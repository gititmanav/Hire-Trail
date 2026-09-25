/** Scroll-linked progress for the landing's scenes.
 *
 *  One passive scroll listener and at most one frame of work per scroll;
 *  geometry is measured on resize / layout change, never per frame. A scene
 *  is a section with a 0 → 1 progress:
 *   - "pin"  — while its sticky stage is held: from the section's top reaching
 *              the viewport top until its bottom meets the stage's bottom.
 *   - "view" — from its top entering the viewport bottom until its bottom
 *              leaves the viewport top.
 *  Scenes write styles straight to the DOM from their callback — no React
 *  state per frame.
 *
 *  It also reports the tone (dark / light) of whatever sits under the header
 *  (elements marked `data-lp-tone`; the smallest band wins, so a marker inside
 *  a section overrides the section) and whether the page has left the top. */
import { appScrollRoot } from "../../../utils/scrollRoot.ts";

export type Tone = "dark" | "light";
export type SceneMode = "pin" | "view";

/** `p` is 0…1; `px` is how far into the scene's range the page has scrolled. */
export type ProgressFn = (p: number, px: number, span: number) => void;

interface Scene {
  el: HTMLElement;
  stage: HTMLElement | null;
  mode: SceneMode;
  onProgress: ProgressFn;
  start: number;
  span: number;
  last: number;
}

interface ToneBand { top: number; bottom: number; tone: Tone }

/** The header's middle, from the viewport top. */
const HEADER_LINE = 34;
const SCROLLED_AFTER = 30;

const scenes = new Set<Scene>();
let bands: ToneBand[] = [];
const toneListeners = new Set<(t: Tone) => void>();
const scrolledListeners = new Set<(s: boolean) => void>();
let tone: Tone = "dark";
let scrolled = false;
let frame = 0;
let measureFrame = 0;
let attachedTo: HTMLElement | Window | null = null;
let resizeObserver: ResizeObserver | null = null;

function root(): HTMLElement {
  return appScrollRoot();
}

/** The document scrolls on the landing; the app shell scrolls its card. */
function scrollTarget(): HTMLElement | Window {
  const r = root();
  return r === document.scrollingElement || r === document.documentElement ? window : r;
}

export function scrollTop(): number {
  return root().scrollTop;
}

function measure() {
  measureFrame = 0;
  const top = scrollTop();
  const vh = window.innerHeight;
  for (const s of scenes) {
    const rect = s.el.getBoundingClientRect();
    const docTop = rect.top + top;
    if (s.mode === "pin") {
      s.start = docTop;
      s.span = Math.max(1, rect.height - (s.stage ? s.stage.offsetHeight : vh));
    } else {
      s.start = docTop - vh;
      s.span = Math.max(1, rect.height + vh);
    }
    s.last = NaN; // geometry moved — every scene repaints once
  }
  bands = Array.from(document.querySelectorAll<HTMLElement>("[data-lp-tone]"), (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + top, bottom: r.bottom + top, tone: el.dataset.lpTone === "light" ? "light" : "dark" };
  });
  update();
}

function update() {
  frame = 0;
  const top = scrollTop();
  for (const s of scenes) {
    const px = Math.min(s.span, Math.max(0, top - s.start));
    const p = px / s.span;
    if (p !== s.last) {
      s.last = p;
      s.onProgress(p, px, s.span);
    }
  }
  const y = top + HEADER_LINE;
  let best: ToneBand | null = null;
  for (const b of bands) {
    if (y >= b.top && y < b.bottom && (!best || b.bottom - b.top < best.bottom - best.top)) best = b;
  }
  const nextTone = best?.tone ?? "dark";
  if (nextTone !== tone) {
    tone = nextTone;
    toneListeners.forEach((fn) => fn(tone));
  }
  const nextScrolled = top > SCROLLED_AFTER;
  if (nextScrolled !== scrolled) {
    scrolled = nextScrolled;
    scrolledListeners.forEach((fn) => fn(scrolled));
  }
}

const onScroll = () => {
  if (!frame) frame = requestAnimationFrame(update);
};

/** Re-read every scene's geometry on the next frame. */
export function remeasure() {
  if (!measureFrame) measureFrame = requestAnimationFrame(measure);
}

function attach() {
  if (attachedTo) return;
  attachedTo = scrollTarget();
  attachedTo.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  resizeObserver = new ResizeObserver(remeasure);
  resizeObserver.observe(document.body);
  document.fonts?.ready.then(remeasure).catch(() => {});
}

function detachIfIdle() {
  if (scenes.size || toneListeners.size || scrolledListeners.size || !attachedTo) return;
  attachedTo.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", remeasure);
  window.removeEventListener("load", remeasure);
  resizeObserver?.disconnect();
  resizeObserver = null;
  attachedTo = null;
  cancelAnimationFrame(frame);
  cancelAnimationFrame(measureFrame);
  frame = measureFrame = 0;
}

export function registerScene(
  el: HTMLElement,
  opts: { mode: SceneMode; stage?: HTMLElement | null; onProgress: ProgressFn },
): () => void {
  const scene: Scene = { el, stage: opts.stage ?? null, mode: opts.mode, onProgress: opts.onProgress, start: 0, span: 1, last: NaN };
  scenes.add(scene);
  attach();
  remeasure();
  return () => {
    scenes.delete(scene);
    detachIfIdle();
  };
}

export function onTone(fn: (t: Tone) => void): () => void {
  toneListeners.add(fn);
  attach();
  remeasure();
  fn(tone);
  return () => {
    toneListeners.delete(fn);
    detachIfIdle();
  };
}

export function onScrolled(fn: (s: boolean) => void): () => void {
  scrolledListeners.add(fn);
  attach();
  fn(scrollTop() > SCROLLED_AFTER);
  return () => {
    scrolledListeners.delete(fn);
    detachIfIdle();
  };
}

/** Smooth-scroll the page so `el` sits `offset` px below the viewport top. */
export function scrollToElement(el: HTMLElement, offset = 0) {
  const top = el.getBoundingClientRect().top + scrollTop() - offset;
  root().scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* ─── Easing helpers for scene callbacks ─── */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Where `p` sits inside [a, b], clamped to 0…1. */
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** cubic-bezier(0.16, 1, 0.3, 1)'s feel, without the solver: a strong ease-out. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeInOut = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
export const easeIn = (t: number) => t * t * t;
