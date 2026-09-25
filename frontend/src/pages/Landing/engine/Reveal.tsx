/** Content that rises into place the first time it scrolls into view.
 *
 *  Unlike a class toggled by JS alone, the content is visible by default:
 *  it only starts hidden once the observer is known to work, and an element
 *  already on screen at mount (a jump link, a reload mid-page) is shown at
 *  once — nothing ever sits invisible waiting for a scroll. */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "./scroll.ts";

export default function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already visible: stay static
    setState("waiting");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState("shown");
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${state === "waiting" ? "lp-reveal-wait" : state === "shown" ? "lp-reveal-in" : ""} ${className}`}
      style={state === "shown" && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
