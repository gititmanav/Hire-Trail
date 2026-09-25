/** The founder's line — the turn back to white. Pinned for a moment: the dark
 *  lifts to white, then the sentence lights up word by word as you read it.
 *  Reduced motion: the same, as colour only (nothing moves). */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useReducedMotion, useScene } from "../engine/hooks.ts";
import { easeInOut, range } from "../engine/scroll.ts";

const LINE = "Forty applications in, my spreadsheet had become a graveyard. Every better tool wanted a credit card. So I built the one I needed — and made it free.";
const WORDS = LINE.split(" ");

/** Resting words on white, and the ink they light up to. */
const DIM = 212;
const INK = 23;

export default function FounderScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const signRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useScene(sectionRef, "pin", (p) => {
    const white = easeInOut(range(p, 0, 0.14));
    if (whiteRef.current) whiteRef.current.style.opacity = white.toFixed(3);
    // Words appear on white only — before that they'd be dark on dark.
    const reveal = range(p, 0.16, 0.8) * (WORDS.length + 2);
    wordRefs.current.forEach((el, i) => {
      if (!el) return;
      const lit = Math.min(1, Math.max(0, reveal - i) / 2.2);
      const level = Math.round(DIM + (INK - DIM) * lit);
      el.style.color = `rgb(${level}, ${level}, ${level})`;
      el.style.opacity = white.toFixed(3);
    });
    const sign = range(p, 0.8, 0.9);
    if (signRef.current) {
      signRef.current.style.opacity = sign.toFixed(3);
      signRef.current.style.transform = reducedRef.current ? "none" : `translate3d(0, ${Math.round((1 - sign) * 10)}px, 0)`;
    }
  }, stageRef);

  return (
    <section ref={sectionRef} className="lp-founder relative" aria-label="Why HireTrail exists">
      {/* The header reads dark until the page has turned white — halfway
          through its fade, 7% into the 120svh pin (see .lp-founder). */}
      <div data-lp-tone="dark" className="absolute inset-x-0 top-0 h-[8.5vh] h-[8.5svh] pointer-events-none" />
      <div data-lp-tone="light" className="absolute inset-x-0 top-[8.5vh] top-[8.5svh] bottom-0 pointer-events-none" />
      {/* 100lvh: the stage still fills the screen once a phone's toolbars tuck away. */}
      <div ref={stageRef} className="sticky top-0 h-screen h-lvh overflow-hidden bg-[hsl(var(--lp-night))]">
        <div ref={whiteRef} className="absolute inset-0 bg-white" style={{ opacity: 0 }} />
        <div className="relative h-full max-w-[1080px] mx-auto px-6 flex flex-col justify-center lp-on-light">
          <p className="lp-founder-line">
            {WORDS.map((w, i) => (
              <span key={i} ref={(el) => { wordRefs.current[i] = el; }} style={{ color: `rgb(${DIM},${DIM},${DIM})`, opacity: 0 }}>
                {w}{i < WORDS.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <div ref={signRef} className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-6" style={{ opacity: 0 }}>
            <span className="w-12 h-12 rounded-full bg-[hsl(var(--lp-ink))] text-white text-[15px] font-semibold flex items-center justify-center">MK</span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[hsl(var(--lp-ink))]">Manav Kaneria</p>
              <p className="text-[14px] text-[hsl(var(--lp-fog-light))]">Built HireTrail in grad school</p>
            </div>
            <Link to="/about" className="lp-link basis-full sm:basis-auto sm:ml-auto whitespace-nowrap text-[15px] text-[hsl(var(--lp-ink))]">
              Read the story <ArrowRight size={15} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
