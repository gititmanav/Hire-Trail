/** "And everything else" — a pinned list of big words. The list glides up as
 *  you scroll; the word on the reading line is lit by a spotlight, its line of
 *  copy fades in beneath it and a piece of the real app appears beside it (on
 *  a phone, beneath it — the same scrubbed hand-off, placed by Landing.css).
 *  Reduced motion: the list doesn't travel — the lit word simply changes. */
import { useCallback, useLayoutEffect, useRef } from "react";
import { useReducedMotion, useScene } from "../engine/hooks.ts";
import { clamp01, range } from "../engine/scroll.ts";
import { AIVignette, CalendarVignette, ContactsVignette, DeadlinesVignette, ImportVignette, SearchVignette } from "./Vignettes.tsx";

const ITEMS = [
  { word: "⌘K", line: "Find any application, company, contact or deadline in a keystroke.", Vignette: SearchVignette },
  { word: "Calendar", line: "Deadlines, follow-ups and every stage change on one calendar. Drag to reschedule.", Vignette: CalendarVignette },
  { word: "Deadlines", line: "OA due dates, follow-ups and thank-you notes, sorted by what’s next.", Vignette: DeadlinesVignette },
  { word: "Contacts", line: "Recruiters and referrals, tied to the companies you’re applying to.", Vignette: ContactsVignette },
  { word: "Import", line: "Bring your spreadsheet in. Take everything with you as CSV or JSON.", Vignette: ImportVignette },
  { word: "Your AI", line: "Free built-in AI — or bring your own key from 40+ providers.", Vignette: AIVignette },
];

export default function EverythingScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Each row's top within the list — rows differ when a line wraps. */
  const rowTops = useRef<number[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    rowTops.current = Array.from(list.children, (row) => (row as HTMLElement).offsetTop);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const paint = useCallback((p: number) => {
    // A position along the list: 0 → the first word on the line, n-1 → the
    // last. The list glides with the scroll, 1:1 — never holding still under
    // a moving scroll (that reads as the page resisting).
    const pos = clamp01(p) * (ITEMS.length - 1);
    const still = reducedRef.current;
    const current = Math.round(pos);
    if (listRef.current) {
      const tops = rowTops.current;
      const at = still ? current : pos;
      const i = Math.min(tops.length - 1, Math.floor(at));
      const next = Math.min(tops.length - 1, i + 1);
      const y = (tops[i] ?? 0) + ((tops[next] ?? 0) - (tops[i] ?? 0)) * (at - i);
      listRef.current.style.transform = `translate3d(0, ${-Math.round(y * 10) / 10}px, 0)`;
    }
    // Distance of each word from the reading line, in steps.
    const dist = (i: number) => (still ? (i === current ? 0 : 1) : Math.abs(pos - i));
    wordRefs.current.forEach((el, i) => {
      if (!el) return;
      // Fully lit near the line, dimming as it moves off — a spotlight on a moving list.
      const t = range(dist(i), 0.12, 0.62);
      const light = 1 - t * t * (3 - 2 * t);
      const level = Math.round(56 + (255 - 56) * light);
      el.style.color = `rgb(${level}, ${level}, ${level})`;
    });
    lineRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = (1 - range(dist(i), 0.18, 0.46)).toFixed(3);
    });
    // The pieces of the app hand over at the midpoint: the next one dissolves
    // in over this one, which holds until it's mostly covered — never empty,
    // and never two half-faded pieces showing through each other.
    const last = ITEMS.length - 1;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const o = still
        ? (i === current ? 1 : 0)
        : (i === 0 ? 1 : range(pos - i + 1, 0.4, 0.6)) * (i === last ? 1 : 1 - range(pos - i, 0.5, 0.6));
      el.style.opacity = o.toFixed(3);
      el.style.transform = still ? "none" : `translate3d(0, ${Math.round((pos - i) * -24)}px, 0) scale(${(0.975 + 0.025 * o).toFixed(4)})`;
      el.style.visibility = o > 0.001 ? "visible" : "hidden";
    });
  }, []);

  useScene(sectionRef, "pin", (p) => paint(p), stageRef);

  return (
    <section ref={sectionRef} className="lp-everything relative bg-[hsl(var(--lp-night))] text-white" data-lp-tone="dark" aria-labelledby="lp-everything-title">
      <div ref={stageRef} className="sticky top-0 h-screen h-svh overflow-hidden">
        {/* The spotlight on the reading line, from the left edge. */}
        <div className="lp-reading-light" aria-hidden />
        <div className="absolute inset-x-0 top-[13%] z-10 max-w-[1320px] mx-auto px-6">
          <p id="lp-everything-title" className="lp-eyebrow text-[hsl(var(--lp-fog-dark))]">And everything else.</p>
        </div>
        <div className="relative h-full max-w-[1320px] mx-auto px-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-8">
          <div className="lp-words-col relative min-w-0">
            <div className="lp-reading-window relative">
              <div ref={listRef} className="will-change-transform">
                {ITEMS.map((item, i) => (
                  <div key={item.word} className="lp-word-row">
                    <p ref={(el) => { wordRefs.current[i] = el; }} className="lp-word" style={{ color: i === 0 ? "#fff" : "rgb(56,56,56)" }}>
                      {item.word}
                    </p>
                    <p ref={(el) => { lineRefs.current[i] = el; }} className="lp-word-line lp-lede text-[hsl(var(--lp-fog-dark))]" style={{ opacity: i === 0 ? 1 : 0 }}>
                      {item.line}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lp-vignettes theme-dark dark">
            {ITEMS.map((item, i) => (
              <div
                key={item.word}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="absolute inset-x-0 max-w-[520px] mx-auto"
                style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
                aria-hidden
              >
                <item.Vignette />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
