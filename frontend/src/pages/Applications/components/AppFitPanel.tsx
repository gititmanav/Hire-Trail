/**
 * Right-most rail on every ApplicationRow: the fit check, summarised.
 *
 * Visual: a contained dark card with the match score (0–10) and its band as
 * the dominant element, and a checkmark list of matched skills below.
 *
 * State machine
 *   ─────────────────────────────────────────────────────────────────
 *   none              → "Set up your profile" / "Add a job description" / "Check fit"
 *   processing        → AiPulse + "Checking your fit…"
 *   waiting_assistant → the check runs in the person's own assistant; quiet note
 *   deferred          → daily-cap reached; surfaces a "Run now" CTA
 *   failed            → short reason + "Retry" CTA
 *   succeeded         → score + band label + ✓ skill list
 *
 * The whole panel is a single click target → opens the application.
 */
import { memo } from "react";
import { Check, Sparkle } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import { cssPalette } from "../../../utils/palette.ts";
import { formatScore, SCORE_BAND_LABEL, scoreBand, type ScoreBand } from "../../../utils/matchScore.ts";
import type { AppFit, FitStatus } from "../../../types";

/** Band label colour. The panel is always dark, so the 400 shades — the
 *  light-mode 600s of SCORE_BAND_TEXT would sink into the background. */
const BAND_ON_DARK: Record<ScoreBand, string> = {
  strong: "emerald-400",
  good: "amber-400",
  fair: "red-400",
};

interface Props {
  fit?: AppFit | null;
  /** Click opens the result; the parent decides where. */
  onOpen: (sessionId: string | null) => void;
  /** Whether the signed-in user has finished their master profile. When false,
   *  the "none" state nudges profile setup. When true, the "none" state
   *  surfaces a "Check fit" CTA (or a "Add JD first" hint when the
   *  application is missing its JD). */
  hasMasterProfile?: boolean;
  /** Whether this specific application has a job description on record. Drives
   *  the empty-state copy: no JD = no check possible until one is added. */
  hasJobDescription?: boolean;
  /** The on-create AI extraction pass is still reading/cleaning this posting.
   *  Takes visual priority over fit state — the fit check only runs afterwards. */
  extracting?: boolean;
  /** Trigger a (re)run of the fit check. Wired to the "Check fit" / "Retry"
   *  / "Run now" CTAs; when present, those states act on click instead of
   *  opening an empty result. */
  onRun?: () => void;
}

function Checkmark() {
  return (
    <Check size={11} strokeWidth={3} aria-hidden className="shrink-0 text-emerald-400" />
  );
}

function FitPanelImpl({ fit, onOpen, hasMasterProfile = true, hasJobDescription = true, extracting = false, onRun }: Props) {
  const status: FitStatus | "none" = fit?.status ?? "none";
  // typeof, not ?? null: fit summaries written before the 0–10 score lack the field.
  const score = status === "succeeded" && typeof fit?.score === "number" ? fit.score : null;
  const band = score !== null ? scoreBand(score) : null;

  // States where the panel offers an action (run/retry) rather than a result.
  // Clicking these runs the check directly instead of opening an empty result.
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
      className="w-[200px] shrink-0 text-left text-white flex flex-col gap-2 p-3 border-l border-white/10 cursor-pointer transition-colors hover:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ background: `linear-gradient(160deg, ${cssPalette("neutral-900")} 0%, ${cssPalette("neutral-800")} 100%)` }}
      aria-label={
        score !== null && band
          ? `Match score ${formatScore(score)} out of 10, ${SCORE_BAND_LABEL[band].toLowerCase()}. Click to view the fit check.`
          : status === "succeeded"
          ? "Fit check done. Click to view it."
          : status === "processing"
          ? "Fit check in progress"
          : status === "waiting_assistant"
          ? "Fit check waiting for your assistant"
          : status === "failed"
          ? `Fit check failed: ${fit?.errorMessage ?? "unknown"}`
          : status === "deferred"
          ? "Fit check deferred"
          : "Fit check not available"
      }
    >
      {/* Header strip — a small label, kept quiet so the score below stays
       *  the dominant element. */}
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
        <Sparkle size={10} strokeWidth={2} aria-hidden />
        Fit check
      </span>

      {extracting ? (
        <div className="flex items-center gap-2 text-[11px] text-white/90">
          <AiPulse size={13} />
          Reading this posting…
        </div>
      ) : status === "succeeded" && fit ? (
        <>
          {/* The score — the dominant element; the band word carries the colour. */}
          {score !== null && band && (
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[18px] font-bold leading-none tabular-nums text-white">
                {formatScore(score)}
                <span className="text-[11px] font-medium text-white/60">/10</span>
              </span>
              <span className="text-[11px] font-semibold truncate" style={{ color: cssPalette(BAND_ON_DARK[band]) }}>
                {SCORE_BAND_LABEL[band]}
              </span>
            </div>
          )}
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
              {fit.matchedCount} matched · {fit.missingCount} missing
            </p>
          )}
        </>
      ) : status === "processing" ? (
        <div className="flex items-center gap-2 text-[11px] text-white/90">
          <AiPulse size={13} />
          Checking your fit…
        </div>
      ) : status === "waiting_assistant" ? (
        // Nothing is running here — the check waits in the person's own
        // assistant — so no pulse, just a quiet note.
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] text-white/85 leading-snug">Waiting for your assistant</p>
          <p className="text-[10.5px] text-white/55 leading-snug">Ask it to do your HireTrail AI tasks.</p>
        </div>
      ) : status === "deferred" ? (
        <p className="text-[11px] text-white/85 leading-snug">
          Daily auto-check limit reached. <span className="underline">Run now →</span>
        </p>
      ) : status === "failed" ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] text-white/85 line-clamp-2">{fit?.errorMessage || "The fit check didn't finish."}</p>
          <span className="text-[10.5px] text-white/70 underline">Retry →</span>
        </div>
      ) : !hasMasterProfile ? (
        // Genuine "you need to do setup" case — only shown when the user has
        // no master profile at all. Without this guard the message used to
        // appear even for users who'd long-since set up their profile.
        <p className="text-[11px] text-white/75 leading-snug">
          <span className="underline">Set up your profile</span> to check your fit.
        </p>
      ) : !hasJobDescription ? (
        <p className="text-[11px] text-white/75 leading-snug">
          Add a job description to this application to check your fit.
        </p>
      ) : (
        <p className="text-[11px] text-white/85 leading-snug">
          <span className="underline">Check fit →</span>
        </p>
      )}
    </button>
  );
}

export default memo(FitPanelImpl);
