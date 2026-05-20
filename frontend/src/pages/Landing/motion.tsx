import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/* ─────────────────────────── motion utilities ─────────────────────────── */

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setShown(true); obs.disconnect(); }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Counts up from 0 → value once visible. Writes textContent directly via ref —
 *  no setState, so no React reconciliation during the 1.1s animation. */
export function Counter({ value, suffix = "", duration = 1100 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = `0${suffix}`;
    let started = false;
    let raf = 0;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started) {
          started = true;
          obs.disconnect();
          const t0 = performance.now();
          const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - k, 3);
            if (ref.current) ref.current.textContent = `${Math.round(value * eased)}${suffix}`;
            if (k < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value, suffix, duration]);
  return <span ref={ref}>0{suffix}</span>;
}

/** Translates a child along Y based on viewport scroll relative to its container.
 *  Subtle (~60 px travel) so it adds depth without seasickness. Disabled on
 *  prefers-reduced-motion.
 *
 *  Perf: writes the transform directly via ref — no setState, no React
 *  reconciliation per frame. Also no CSS `transition-transform`: the rAF
 *  tick already runs at native 60fps; a transition would just create a tween
 *  that the next frame immediately overrides, producing visible jitter. */
export function Parallax({ children, factor = 0.18, className = "" }: { children: ReactNode; factor?: number; className?: string }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let lastY = 0;
    let inView = true;
    // Observe the wrapper — only run the scroll math when the parallaxed
    // element is actually visible. Outside the viewport we skip the scroll
    // handler's body entirely so other sections scroll at full speed.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView = e.isIntersecting;
    }, { rootMargin: "100px" });
    if (wrap.current) io.observe(wrap.current);
    const apply = () => {
      raf = 0;
      if (!inView) return;
      const el = wrap.current;
      const child = inner.current;
      if (!el || !child) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const next = Math.max(-60, Math.min(60, -center * factor));
      if (next === lastY) return;
      lastY = next;
      child.style.transform = `translate3d(0, ${next}px, 0)`;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [factor]);
  return (
    <div ref={wrap} className={className}>
      <div ref={inner} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/** Card with a mouse-tracked radial glow (Vercel/Linear style). Pure CSS via
 *  CSS variables — no re-renders on mousemove, just style mutation. */
export function GlowCard({ children, className = "", glow = "rgba(59,130,246,0.22)" }: { children: ReactNode; className?: string; glow?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      style={{ ["--glow" as string]: glow } as CSSProperties}
      className={`relative group ${className}`}
    >
      <div aria-hidden className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "radial-gradient(280px circle at var(--mx) var(--my), var(--glow), transparent 80%)" }}
      />
      {children}
    </div>
  );
}

/** Subtle dotted-grid backdrop, masked to fade at the edges. Drop inside any
 *  `relative overflow-hidden` section. `tone` swaps line color between
 *  near-black (for light sections) and white (for dark sections). */
export function GridTexture({ tone = "light" }: { tone?: "light" | "dark" }) {
  const cls = tone === "dark"
    ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]"
    : "bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:56px_56px]";
  return <div aria-hidden className={`absolute inset-0 pointer-events-none ${cls} [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]`} />;
}
