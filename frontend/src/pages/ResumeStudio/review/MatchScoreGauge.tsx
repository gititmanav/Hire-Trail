/** Match-score gauge (0–10). Animates the ring + number from before→after when
 *  a rewrite returns {score:{before,after}}; otherwise shows the current score.
 *  Includes an info tooltip explaining what the score measures. */
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import HoverCard from "../../../components/ui/HoverCard.tsx";
import { cssPalette } from "../../../utils/palette.ts";

function label(score: number): { text: string; color: string } {
  if (score >= 7.5) return { text: "Excellent", color: cssPalette("emerald-500") };
  if (score >= 5) return { text: "Good", color: cssPalette("amber-500") };
  return { text: "Fair", color: cssPalette("red-500") };
}

const R = 46;
const CIRC = 2 * Math.PI * R;

export default function MatchScoreGauge({
  score,
  anim,
  size = 132,
}: {
  /** Current score (0–10). */
  score: number;
  /** When set, animate from before→after (e.g. just after a rewrite). */
  anim?: { before: number; after: number } | null;
  size?: number;
}) {
  const [display, setDisplay] = useState(score);
  const raf = useRef<number | null>(null);

  // Animate the number from `from` → `to` over ~700ms.
  useEffect(() => {
    const from = anim ? anim.before : display;
    const to = anim ? anim.after : score;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, score]);

  const clamped = Math.max(0, Math.min(10, display));
  const pct = clamped / 10;
  const { text, color } = label(clamped);
  const offset = CIRC * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 110 110" className="-rotate-90">
          {/* Colors via style: presentation attributes don't resolve CSS variables everywhere. */}
          <circle cx="55" cy="55" r={R} fill="none" strokeWidth="9" style={{ stroke: "hsl(var(--muted))" }} />
          <circle
            cx="55" cy="55" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ stroke: color, transition: "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1), stroke 400ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-foreground leading-none">{clamped.toFixed(1)}</span>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5">/ 10</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-sm font-semibold" style={{ color }}>{text}</span>
        <HoverCard
          interactive={false}
          width={232}
          ariaLabel="What this measures"
          content={
            <p className="px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
              How well this resume matches the target role — keyword coverage, relevance, and the strength of your bullets. Rewrites that add metrics and JD keywords push it up.
            </p>
          }
        >
          <button type="button" aria-label="What this measures" className="inline-flex text-muted-foreground cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Info size={13} strokeWidth={2} aria-hidden />
          </button>
        </HoverCard>
      </div>
    </div>
  );
}
