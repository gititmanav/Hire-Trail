import { useEffect, useMemo, useState } from "react";

type Slide = { src: string; caption: string; tone?: "light" | "dark" };

const DEFAULT_SLIDES: Slide[] = [
  { src: "/Dashboard.png", caption: "Dashboard that makes priorities obvious", tone: "light" },
  { src: "/Dashboard-Darkmode.png", caption: "Dark mode that still feels crisp", tone: "dark" },
  { src: "/Kanban%20Board.png", caption: "Kanban pipeline with real momentum", tone: "light" },
  { src: "/Kanban%20Board%20Dark.png", caption: "Same workflow — nocturne edition", tone: "dark" },
  { src: "/Resume.png", caption: "Resumes, versions, and quick review", tone: "light" },
];

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

export default function ScreenshotCarousel({ slides = DEFAULT_SLIDES }: { slides?: Slide[] }) {
  const safeSlides = useMemo(() => slides.filter((s) => Boolean(s?.src)), [slides]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (safeSlides.length <= 1) return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) return;
    const timer = window.setInterval(() => setActive((i) => clampIndex(i + 1, safeSlides.length)), 5200);
    return () => window.clearInterval(timer);
  }, [safeSlides.length]);

  if (safeSlides.length === 0) return null;

  const a = clampIndex(active, safeSlides.length);
  const prev = clampIndex(a - 1, safeSlides.length);
  const next = clampIndex(a + 1, safeSlides.length);

  const ordered = [
    { idx: prev, role: "prev" as const },
    { idx: a, role: "active" as const },
    { idx: next, role: "next" as const },
  ];

  return (
    <div className="w-full max-w-[980px]">
      <div className="auth-showcase">
        <div className="auth-showcase-stage auth-product-frame">
          <div className="auth-showcase-spotlight" aria-hidden />

          {ordered.map(({ idx, role }) => {
            const s = safeSlides[idx];
            return (
              <button
                key={`${role}-${s.src}`}
                type="button"
                className={`auth-showcase-card auth-showcase-card--${role}`}
                onClick={() => setActive(idx)}
                aria-label={`View: ${s.caption}`}
              >
                <img
                  src={s.src}
                  alt={s.caption}
                  className="auth-showcase-img"
                  loading={role === "active" ? "eager" : "lazy"}
                  decoding="async"
                />
                <div className="auth-showcase-glass" aria-hidden />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground min-h-[20px]">
            {safeSlides[a].caption}
          </p>

          <div className="flex items-center gap-2">
            {safeSlides.map((s, i) => (
              <button
                key={`${s.src}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`auth-showcase-dot ${i === a ? "auth-showcase-dot--active" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
