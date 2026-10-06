/** The compact match score: a small ring filled to the score, and the number.
 *  For tables, rows, cards and hover cards — the Studio keeps the big gauge.
 *  The ring is the same band colour as the gauge; the label is the number. */
import { formatScore, SCORE_BAND_LABEL, scoreBand, scoreBandColor } from "../../utils/matchScore.ts";

const R = 7;
const CIRC = 2 * Math.PI * R;

export default function ScoreChip({ score, size = "sm", className = "" }: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const band = scoreBand(score);
  const px = size === "md" ? 20 : 16;
  const pct = Math.max(0, Math.min(10, score)) / 10;
  return (
    <span
      className={`inline-flex items-center gap-1.5 tabular-nums ${size === "md" ? "text-[13px]" : "text-[12.5px]"} font-semibold text-foreground ${className}`}
      title={`${SCORE_BAND_LABEL[band]} · ${formatScore(score)} / 10`}
    >
      <svg width={px} height={px} viewBox="0 0 18 18" className="-rotate-90 shrink-0" aria-hidden>
        <circle cx="9" cy="9" r={R} fill="none" strokeWidth="2.25" style={{ stroke: "hsl(var(--control))" }} />
        <circle
          cx="9" cy="9" r={R} fill="none" strokeWidth="2.25" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
          style={{ stroke: scoreBandColor(band) }}
        />
      </svg>
      {formatScore(score)}
      <span className="sr-only"> out of 10, {SCORE_BAND_LABEL[band].toLowerCase()}</span>
    </span>
  );
}
