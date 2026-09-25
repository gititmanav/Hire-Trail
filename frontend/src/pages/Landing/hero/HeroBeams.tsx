/** The hero's light beams (see beams.ts). Starts after first paint so the
 *  shader compile never delays the headline, fades in like lights warming up,
 *  and only animates while it is on screen, in a visible tab, and allowed to
 *  (`setActive` — the story fades it out as the page turns white). Reduced
 *  motion gets one still frame. No WebGL2 → a quiet static stand-in. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BeamsRenderer, HERO_BEAMS } from "./beams.ts";
import { prefersReducedMotion } from "../engine/scroll.ts";

export interface HeroBeamsHandle {
  setActive: (active: boolean) => void;
}

/** A frozen moment that reads well behind the headline (reduced motion). */
const STILL_TIME = 2.4;

const HeroBeams = forwardRef<HeroBeamsHandle, { className?: string }>(function HeroBeams({ className = "" }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<BeamsRenderer | null>(null);
  const state = useRef({ onScreen: true, active: true, reduced: prefersReducedMotion() });
  const [status, setStatus] = useState<"pending" | "live" | "fallback">("pending");

  const sync = () => {
    const r = renderer.current;
    if (!r) return;
    const { onScreen, active, reduced } = state.current;
    const run = onScreen && active && !reduced && document.visibilityState === "visible";
    if (run) r.start();
    else r.stop();
  };

  useImperativeHandle(ref, () => ({
    setActive(active: boolean) {
      if (state.current.active === active) return;
      state.current.active = active;
      sync();
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const drawStill = () => {
      const r = renderer.current;
      if (!r) return;
      r.resize();
      if (state.current.reduced) {
        r.time = STILL_TIME;
        r.render();
      }
    };
    const onVisibility = () => sync();
    const onMotionChange = () => {
      state.current.reduced = !!mq?.matches;
      drawStill();
      sync();
    };

    const boot = () => {
      if (disposed) return;
      const r = new BeamsRenderer(canvas, HERO_BEAMS);
      let ok = false;
      try {
        ok = r.init();
      } catch {
        ok = false;
      }
      if (!ok) {
        r.dispose();
        setStatus("fallback");
        return;
      }
      renderer.current = r;
      r.time = STILL_TIME;
      r.resize();
      r.render();
      setStatus("live");
      ro = new ResizeObserver(() => {
        r.resize();
        if (!r.isRunning) r.render();
      });
      ro.observe(canvas);
      io = new IntersectionObserver(([entry]) => {
        state.current.onScreen = entry.isIntersecting;
        sync();
      });
      io.observe(canvas);
      document.addEventListener("visibilitychange", onVisibility);
      mq?.addEventListener("change", onMotionChange);
      sync();
    };

    // After the first paint: the headline and buttons are on screen first.
    // (Safari has no requestIdleCallback.)
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle ? window.requestIdleCallback(boot, { timeout: 300 }) : window.setTimeout(boot, 60);

    return () => {
      disposed = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq?.removeEventListener("change", onMotionChange);
      renderer.current?.dispose();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      {status === "fallback" ? (
        <div className="lp-beams-fallback absolute inset-0" />
      ) : (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full block ${status === "live" ? "lp-fade-in" : "opacity-0"}`}
          style={{ ["--lp-delay" as string]: "80ms" }}
        />
      )}
    </div>
  );
});

export default HeroBeams;
