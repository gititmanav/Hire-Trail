/** The founder's line — the turn back to white. Pinned for a moment: the dark
 *  lifts to white over the word list as it leaves (a hand-off, Landing.css),
 *  then the sentence is inked by the page's sweep of light, line after line,
 *  as you read it, and the founder's mark signs it off.
 *  Reduced motion: the same, as colour only (nothing moves). */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useReducedMotion, useScene } from "../engine/hooks.ts";
import { easeInOut, range } from "../engine/scroll.ts";
import { css } from "../engine/dom.ts";
import Sweep from "../engine/Sweep.tsx";
import monogram from "../assets/mk-monogram.png";

const LINE = "Forty applications in, my spreadsheet had become a graveyard. Every better tool wanted a credit card. So I built the one I needed — and made it free.";

export default function FounderScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const signRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useScene(sectionRef, "pin", (p) => {
    const white = easeInOut(range(p, 0, 0.14));
    if (whiteRef.current) whiteRef.current.style.opacity = white.toFixed(3);
    // The sentence appears on white only — before that it would be dark on dark.
    css(lineRef.current, { opacity: white.toFixed(3) });
    css(sweepRef.current, { "--lp-sweep": range(p, 0.16, 0.8).toFixed(4) });
    const sign = range(p, 0.8, 0.9);
    if (signRef.current) {
      signRef.current.style.opacity = sign.toFixed(3);
      signRef.current.style.transform = reducedRef.current ? "none" : `translate3d(0, ${Math.round((1 - sign) * 10)}px, 0)`;
      // The section lets the pointer through (it lies over the word list); the link opts back in.
      signRef.current.style.pointerEvents = sign > 0.5 ? "auto" : "none";
    }
  }, stageRef);

  return (
    <section ref={sectionRef} className="lp-founder lp-handoff lp-handoff-pass relative" aria-label="Why HireTrail exists">
      {/* The header reads dark until the page has turned white — halfway
          through its fade, 7% into the 90svh pin (see .lp-founder). */}
      <div data-lp-tone="dark" className="lp-band lp-band-before" />
      <div data-lp-tone="light" className="lp-band lp-band-over" />
      <div data-lp-tone="light" className="lp-band lp-band-after" />
      {/* See-through until the white comes in over the word list as it
          leaves; 100lvh so it still fills the screen once a phone's toolbars
          tuck away. */}
      <div ref={stageRef} className="sticky top-0 h-screen h-lvh overflow-hidden">
        <div ref={whiteRef} className="absolute inset-0 bg-white" style={{ opacity: 0 }} />
        <div className="relative h-full max-w-[1080px] mx-auto px-6 flex flex-col justify-center lp-on-light">
          <p ref={lineRef} className="lp-founder-line" style={{ opacity: 0 }}>
            <Sweep ref={sweepRef} tone="light" driven>{LINE}</Sweep>
          </p>
          <div ref={signRef} className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-6" style={{ opacity: 0 }}>
            <img src={monogram} alt="" width={48} height={48} className="w-12 h-12 rounded-[12px]" />
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
