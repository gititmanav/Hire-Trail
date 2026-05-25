/**
 * Right-most rail on every ApplicationRow: the AI fit summary. Always
 * rendered — content adapts to the analysis state so the visual rhythm holds
 * across every row.
 *
 * State machine
 *   ─────────────────────────────────────────────────────────────────
 *   none           → "Set up your profile to enable analysis" link
 *   processing     → animated dots + "Analyzing…"
 *   deferred       → daily-cap reached; surfaces a "Run analysis" CTA
 *   failed         → short reason + "Retry" CTA
 *   succeeded      → big grade letter + score + matched/missing counts
 *
 * The whole panel is a single click target → opens the AI sidebar.
 */
import { memo } from "react";
import type { AppFit, FitStatus } from "../../../types";

const GRADE_TONE: Record<"A" | "B" | "C" | "D" | "F", { ring: string; label: string }> = {
  A: { ring: "ring-emerald-300/60", label: "Strong match" },
  B: { ring: "ring-sky-300/60",     label: "Good match" },
  C: { ring: "ring-amber-300/60",   label: "Mixed match" },
  D: { ring: "ring-orange-300/60",  label: "Weak match" },
  F: { ring: "ring-red-300/60",     label: "Wrong track" },
};

interface Props {
  fit?: AppFit | null;
  /** Click opens the AI sidebar; parent owns sidebar state. */
  onOpen: (sessionId: string | null) => void;
}

function StatusBar({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
      {children}
    </span>
  );
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

function FitPanelImpl({ fit, onOpen }: Props) {
  const status: FitStatus | "none" = fit?.status ?? "none";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(fit?.sessionId ?? null); }}
      className="w-[180px] shrink-0 text-left text-white flex flex-col gap-2 p-3 border-l border-white/10 cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)" }}
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
      <div className="flex items-center justify-between">
        <StatusBar>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 2l1.6 4.2L18 8l-4.4 1.8L12 14l-1.6-4.2L6 8l4.4-1.8L12 2z"/>
          </svg>
          AI Fit
        </StatusBar>
        {status === "succeeded" && fit && (
          <span className="text-[10px] font-medium text-white/70 tabular-nums">{fit.fitScore}/5</span>
        )}
      </div>

      {status === "succeeded" && fit ? (
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 rounded-lg bg-white/15 ring-1 ring-inset ${GRADE_TONE[(fit.fitGrade || "C") as "A" | "B" | "C" | "D" | "F"]?.ring ?? "ring-white/30"} flex items-center justify-center text-[20px] font-bold leading-none`}
          >
            {fit.fitGrade || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-tight">
              {GRADE_TONE[(fit.fitGrade || "C") as "A" | "B" | "C" | "D" | "F"]?.label ?? "Analyzed"}
            </p>
            <p className="text-[10.5px] text-white/70 leading-tight tabular-nums">
              {fit.matchedCount} matched · {fit.missingCount} gap{fit.missingCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
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
        <p className="text-[11px] text-white/80 leading-snug">
          <span className="underline">Set up your profile</span> to enable AI analysis.
        </p>
      )}
    </button>
  );
}

export default memo(FitPanelImpl);
