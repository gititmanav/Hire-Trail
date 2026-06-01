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
import { Check, Sparkle } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
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
  /** Whether the signed-in user has finished their master profile. When false,
   *  the "none" state nudges profile setup. When true, the "none" state
   *  surfaces a "Run analysis" CTA (or a "Add JD first" hint when the
   *  application is missing its JD). */
  hasMasterProfile?: boolean;
  /** Whether this specific application has a job description on record. Drives
   *  the empty-state copy: no JD = no analysis possible until one is added. */
  hasJobDescription?: boolean;
  /** The on-create AI extraction pass is still reading/cleaning this posting.
   *  Takes visual priority over fit state — fit analysis only runs afterwards. */
  extracting?: boolean;
  /** Trigger a (re)run of fit analysis. Wired to the "Run AI analysis" / "Retry"
   *  / "Run now" CTAs; when present, those states act on click instead of
   *  opening the (empty) sidebar. */
  onRun?: () => void;
}

function Checkmark() {
  return (
    <Check size={11} strokeWidth={3} aria-hidden className="shrink-0 text-emerald-400" />
  );
}

function FitPanelImpl({ fit, onOpen, hasMasterProfile = true, hasJobDescription = true, extracting = false, onRun }: Props) {
  const status: FitStatus | "none" = fit?.status ?? "none";
  const grade = (fit?.fitGrade || "") as Grade | "";
  const meta = grade ? GRADE_META[grade] : null;

  // States where the panel offers an action (run/retry) rather than a result.
  // Clicking these runs analysis directly instead of opening an empty sidebar.
  const actionable =
    !extracting && !!onRun &&
    (status === "failed" || status === "deferred" ||
      (status === "none" && hasMasterProfile && hasJobDescription));

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (extracting) return;
        if (actionable) { onRun!(); return; }
        onOpen(fit?.sessionId ?? null);
      }}
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
          <Sparkle size={10} strokeWidth={2} aria-hidden />
          AI Fit
        </span>
        {status === "succeeded" && fit && (
          <span className="text-[10px] font-medium text-white/60 tabular-nums">{fit.fitScore}/5</span>
        )}
      </div>

      {extracting ? (
        <div className="flex items-center gap-2 text-[11px] text-white/90">
          <AiPulse size={13} />
          Reading this posting…
        </div>
      ) : status === "succeeded" && fit && meta ? (
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
          <AiPulse size={13} />
          Scoring your fit…
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
      ) : !hasMasterProfile ? (
        // Genuine "you need to do setup" case — only shown when the user has
        // no master profile at all. Without this guard the message used to
        // appear even for users who'd long-since set up their profile.
        <p className="text-[11px] text-white/75 leading-snug">
          <span className="underline">Set up your profile</span> to enable AI analysis.
        </p>
      ) : !hasJobDescription ? (
        <p className="text-[11px] text-white/75 leading-snug">
          Add a job description to this application to run AI analysis.
        </p>
      ) : (
        <p className="text-[11px] text-white/85 leading-snug">
          <span className="underline">Run AI analysis →</span>
        </p>
      )}
    </button>
  );
}

export default memo(FitPanelImpl);
