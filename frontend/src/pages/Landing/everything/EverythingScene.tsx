/** "And everything else" — a pinned list of big words. The list glides up as
 *  you scroll; the word on the reading line is lit by a spotlight, its line of
 *  copy fades in beneath it and a piece of the real app appears beside it (on
 *  a phone, beneath it — the same scrubbed hand-off, placed by Landing.css).
 *  The first word is the shortcut itself: two keys that go down as it reaches
 *  the line, and the search beside it types. Reduced motion: the list doesn't
 *  travel — the lit word simply changes. */
import { useCallback, useLayoutEffect, useRef } from "react";
import { Command } from "lucide-react";
import { useReducedMotion, useScene } from "../engine/hooks.ts";
import { clamp01, lerp, range } from "../engine/scroll.ts";
import { css, setText } from "../engine/dom.ts";
import { AIVignette, CalendarVignette, ContactsVignette, DeadlinesVignette, ImportVignette, SearchVignette } from "./Vignettes.tsx";

/** The search the ⌘K vignette types as the keys go down. */
const QUERY = "stri";

const ITEMS = [
  { word: "⌘K", line: "Find any application, company, contact or deadline in a keystroke.", Vignette: SearchVignette },
  { word: "Calendar", line: "Deadlines, follow-ups and every stage change on one calendar. Drag to reschedule.", Vignette: CalendarVignette },
  { word: "Deadlines", line: "OA due dates, follow-ups and thank-you notes, sorted by what’s next.", Vignette: DeadlinesVignette },
  { word: "Contacts", line: "Recruiters and referrals, tied to the companies you’re applying to.", Vignette: ContactsVignette },
  { word: "Import", line: "Bring your spreadsheet in. Take everything with you as CSV or JSON.", Vignette: ImportVignette },
  { word: "Your AI", line: "Free built-in AI — or your own key, or your own Claude Code.", Vignette: AIVignette },
];

export default function EverythingScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const keysRef = useRef<HTMLSpanElement>(null);
  const searchParts = useRef<{ query: HTMLElement | null; results: HTMLElement[] }>({ query: null, results: [] });
  /** Each row's top within the list — rows differ when a line wraps. */
  const rowTops = useRef<number[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    rowTops.current = Array.from(list.children, (row) => (row as HTMLElement).offsetTop);
    const search = cardRefs.current[0];
    searchParts.current = {
      query: search?.querySelector<HTMLElement>('[data-lp="query"]') ?? null,
      results: Array.from(search?.querySelectorAll<HTMLElement>('[data-lp="result"]') ?? []),
    };
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const paint = useCallback((p: number) => {
    // A position along the list: 0 → the first word on the line, n-1 → the
    // last. It starts a little short of the first word, so ⌘K arrives on the
    // line like the others. The list glides with the scroll, 1:1 — never
    // holding still under a moving scroll (that reads as the page resisting).
    const last = ITEMS.length - 1;
    const pos = lerp(-0.45, last, clamp01(p));
    const still = reducedRef.current;
    const current = Math.min(last, Math.max(0, Math.round(pos)));
    if (listRef.current) {
      const tops = rowTops.current;
      const at = still ? current : pos;
      const i = Math.max(0, Math.min(tops.length - 2, Math.floor(at)));
      const y = (tops[i] ?? 0) + ((tops[i + 1] ?? 0) - (tops[i] ?? 0)) * (at - i);
      listRef.current.style.transform = `translate3d(0, ${-Math.round(y * 10) / 10}px, 0)`;
    }

    // ⌘K: the keys go down as the word reaches the line and come back up as
    // it leaves; meanwhile the search types and its results come in.
    const press = still ? 1 : range(pos, -0.14, -0.03) * (1 - range(pos, 0.32, 0.44));
    css(keysRef.current, { "--lp-press": Math.round(press * 1000) / 1000 });
    const { query, results } = searchParts.current;
    setText(query, QUERY.slice(0, still ? QUERY.length : Math.round(range(pos, -0.03, 0.2) * QUERY.length)));
    results.forEach((row, j) => css(row, { opacity: still ? 1 : Math.round(range(pos, 0.08 + j * 0.04, 0.18 + j * 0.04) * 1000) / 1000 }));
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
                      {item.word === "⌘K" ? (
                        <>
                          <span className="sr-only">Command K</span>
                          <span ref={keysRef} className="lp-keys" aria-hidden>
                            <kbd className="lp-key"><Command className="lp-key-glyph" strokeWidth={2.2} /></kbd>
                            <kbd className="lp-key"><span className="lp-key-letter">K</span></kbd>
                          </span>
                        </>
                      ) : item.word}
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
