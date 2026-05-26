/**
 * Right-most rail on every ApplicationRow: the AI fit summary.
 *
 * Visual: a contained dark card with a prominent grade band header and a
 * checkmark list of matched skills below — matches the design reference
 * shipped Phase 5 polish. Replaces the previous compact blue-gradient panel.
 *
 * State machine
 *   ─────────────────────────────────────────────────────────────────
 *   none           → "Set up your profile to enable analysis" link
 *   processing     → animated dots + "Analyzing…"
 *   deferred       → daily-cap reached; surfaces a "Run analysis" CTA
 *   failed         → short reason + "Retry" CTA
 *   succeeded      → grade band ("STRONG MATCH") + score chip + ✓ skill list
 *
 * The whole panel is a single click target → opens the AI sidebar.
 */
import { memo } from "react";
import type { AppFit, FitStatus } from "../../../types";

type Grade = "A" | "B" | "C" | "D" | "F";

const GRADE_META: Record<Grade, {
  label: string;
  /** Tailwind classes for the band background (header). */
  band: string;
  /** Tailwind classes for the band text. */
  text: string;
}> = {
  A: { label: "STRONG MATCH", band: "bg-emerald-500/15 border-emerald-500/40",  text: "text-emerald-100" },
  B: { label: "GOOD MATCH",   band: "bg-sky-500/15 border-sky-500/40",          text: "text-sky-100" },
  C: { label: "MIXED MATCH",  band: "bg-amber-500/20 border-amber-500/40",      text: "text-amber-100" },
  D: { label: "WEAK MATCH",   band: "bg-orange-500/20 border-orange-500/40",    text: "text-orange-100" },
  F: { label: "WRONG TRACK",  band: "bg-rose-500/20 border-rose-500/40",        text: "text-rose-100" },
};

interface Props {
  fit?: AppFit | null;
  /** Click opens the AI sidebar; parent owns sidebar state. */
  onOpen: (sessionId: string | null) => void;
}

function pulseDot(delay: string) {
  return (
    <span
      className="inline-block w-1 h-1 rounded-full bg-white/80 animate-pulse"
      style={{ animationDelay: delay }}
      aria-hidden
    />
  );
}

function Checkmark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-emerald-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FitPanelImpl({ fit, onOpen }: Props) {
  const status: FitStatus | "none" = fit?.status ?? "none";
  const grade = (fit?.fitGrade || "") as Grade | "";
  const meta = grade ? GRADE_META[grade] : null;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(fit?.sessionId ?? null); }}
      className="w-[200px] shrink-0 text-left text-white flex flex-col gap-2 p-3 border-l border-white/10 cursor-pointer transition-colors hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)" }}
      aria-label={
        status === "succeeded" && fit
          ? `AI fit ${fit.fitGrade} (${fit.fitScore}/5). Click to view analysis.`
          : status === "processing"
          ? "AI analysis in progress"
          : status === "failed"
          ? `AI analysis failed: ${fit?.errorMessage ?? "unknown"}`
          : status === "deferred"
          ? "AI analysis deferred"
          : "AI analysis not available"
      }
    >
      {/* Header strip — small AI Fit label + score on the right.
       *  Kept compact so the grade band below stays the dominant element. */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 2l1.6 4.2L18 8l-4.4 1.8L12 14l-1.6-4.2L6 8l4.4-1.8L12 2z"/>
          </svg>
          AI Fit
        </span>
        {status === "succeeded" && fit && (
          <span className="text-[10px] font-medium text-white/60 tabular-nums">{fit.fitScore}/5</span>
        )}
      </div>

      {status === "succeeded" && fit && meta ? (
        <>
          {/* Grade band — the dominant element. Coloured + bordered per grade. */}
          <div className={`inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-md border ${meta.band}`}>
            <span className={`text-[18px] font-bold leading-none ${meta.text}`}>{grade}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
          </div>
          {/* Checkmark list of top matched skills. Falls back to a generic
           *  count-only line when the seed / older summaries didn't include
           *  the names. */}
          {fit.topMatched && fit.topMatched.length > 0 ? (
            <ul className="space-y-0.5 mt-0.5">
              {fit.topMatched.map((skill) => (
                <li key={skill} className="flex items-center gap-1.5 text-[11px] text-white/85 leading-tight">
                  <Checkmark />
                  <span className="truncate">{skill}</span>
                </li>
              ))}
              {fit.matchedCount > fit.topMatched.length && (
                <li className="text-[10px] text-white/55 ml-[18px] tabular-nums">
                  +{fit.matchedCount - fit.topMatched.length} more matched
                </li>
              )}
            </ul>
          ) : (
            <p className="text-[10.5px] text-white/65 tabular-nums">
              {fit.matchedCount} matched · {fit.missingCount} gap{fit.missingCount === 1 ? "" : "s"}
            </p>
          )}
        </>
      ) : status === "processing" ? (
        <div className="flex items-center gap-2 text-[11px] text-white/90">
          <span className="inline-flex items-center gap-0.5">
            {pulseDot("0ms")}{pulseDot("150ms")}{pulseDot("300ms")}
          </span>
          Analyzing…
        </div>
      ) : status === "deferred" ? (
        <p className="text-[11px] text-white/85 leading-snug">
          Daily auto-analyze cap reached. <span className="underline">Run now →</span>
        </p>
      ) : status === "failed" ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] text-white/85 line-clamp-2">{fit?.errorMessage || "Analysis failed."}</p>
          <span className="text-[10.5px] text-white/70 underline">Retry →</span>
        </div>
      ) : (
        <p className="text-[11px] text-white/75 leading-snug">
          <span className="underline">Set up your profile</span> to enable AI analysis.
        </p>
      )}
    </button>
  );
}

export default memo(FitPanelImpl);
