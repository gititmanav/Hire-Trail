/** The fit check, inline on the application page (replaces the separate
 *  slide-over). Every state is designed: no job description, never checked,
 *  checking (glow-pulse — never a spinner), waiting for the person's own
 *  assistant, failed, and the result: the one match score (0–10), the AI's
 *  read, strengths, gaps and what to change. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Info, RotateCcw } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import ScoreChip from "../../../components/MatchScore/ScoreChip.tsx";
import Button from "../../../components/ui/Button.tsx";
import HoverCard from "../../../components/ui/HoverCard.tsx";
import { tailorAPI, type FitChange } from "../../../utils/api.ts";
import { hasJobDescription } from "../../../utils/applicationFields.ts";
import { SCORE_BAND_LABEL, SCORE_BAND_TEXT, SCORE_EXPLAINER, scoreBand } from "../../../utils/matchScore.ts";
import type { Application } from "../../../types";

const CHANGE_SECTION: Record<FitChange["section"], string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
};

function Chips({ items, tone }: { items: string[]; tone: "match" | "gap" }) {
  const cls = tone === "match"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-900/25 dark:text-emerald-200 dark:ring-emerald-800/50"
    : "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-900/25 dark:text-amber-200 dark:ring-amber-800/50";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => <span key={k} className={`text-[12px] font-medium px-2 py-0.5 rounded-md ring-1 ring-inset ${cls}`}>{k}</span>)}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[12px] font-medium text-muted-foreground mb-2">{children}</h4>;
}

export default function FitSection({ app, onAnalyze, analyzing, onTailor }: {
  app: Application;
  onAnalyze: () => void;
  analyzing: boolean;
  onTailor: () => void;
}) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const fit = app.fit;
  const sessionId = fit?.sessionId || app.tailorSessionId || "";
  const { data: session, isPending } = useQuery({
    // Keyed on status so a finished check refetches the full session.
    queryKey: ["tailor-session", sessionId, fit?.status],
    queryFn: () => tailorAPI.get(sessionId),
    enabled: !!sessionId && fit?.status === "succeeded",
    staleTime: 5 * 60_000,
  });

  const hasJd = hasJobDescription(app);
  let body: React.ReactNode;

  // Order matters: an existing result always shows (older checks exist for
  // applications whose JD was never saved); "add a JD" only when there's
  // nothing to show and nothing to run the check on.
  if (fit?.status === "processing" || analyzing) {
    body = <AiPulse size={15} label="Checking this role against your profile…" labelSize={13.5} />;
  } else if (fit?.status === "succeeded") {
    body = null; // rendered below
  } else if (fit?.status === "waiting_assistant") {
    // Nothing runs here — the check waits in the person's own assistant — so
    // no pulse, just where to go next.
    body = (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13.5px] text-muted-foreground max-w-lg">
          Waiting for your assistant — ask Claude Code (or your connected assistant) to do your HireTrail AI tasks.
        </p>
        <Button size="sm" variant="ghost" onClick={() => navigate("/settings/ai")}>Change in Settings → AI</Button>
      </div>
    );
  } else if (!hasJd) {
    body = (
      <p className="text-[13.5px] text-muted-foreground max-w-lg">
        Add the job description below and HireTrail will score how well your profile fits this role — matched skills, gaps, and what to change.
      </p>
    );
  } else if (!fit) {
    body = (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13.5px] text-muted-foreground max-w-md">See how your profile stacks up against this posting before you tailor anything.</p>
        <Button size="sm" variant="primary" onClick={onAnalyze}>Check fit</Button>
      </div>
    );
  } else {
    body = (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13.5px] text-muted-foreground max-w-lg">{fit.errorMessage || "The fit check didn't finish."}</p>
        <Button size="sm" onClick={onAnalyze}><RotateCcw size={13} strokeWidth={2} aria-hidden />Retry</Button>
      </div>
    );
  }
  if (fit?.status === "succeeded" && !analyzing) {
    // typeof, not !== null: fit summaries and sessions written before the
    // 0–10 score lack the field entirely.
    const score = typeof fit.score === "number" ? fit.score : typeof session?.matchScore === "number" ? session.matchScore : null;
    const band = score !== null ? scoreBand(score) : null;
    const strengths = session?.strengths ?? [];
    const gaps = session?.gaps ?? [];
    const changes = session?.changes ?? [];
    // Checks from before 2026-10 carry accept/reject suggestions instead of
    // `changes` — they still exist in production, so they keep their list.
    const suggestions = changes.length === 0 ? session?.suggestions ?? [] : [];
    const shownChanges = showAll ? changes : changes.slice(0, 3);
    const shown = showAll ? suggestions : suggestions.slice(0, 3);
    body = (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            {score !== null && band ? (
              <div className="flex items-center gap-2">
                <ScoreChip score={score} size="md" />
                <span className={`text-[14px] font-semibold ${SCORE_BAND_TEXT[band]}`}>{SCORE_BAND_LABEL[band]}</span>
                <HoverCard
                  interactive={false}
                  width={248}
                  ariaLabel="What this score measures"
                  content={<p className="px-3 py-2.5 text-[12px] leading-relaxed text-foreground">{SCORE_EXPLAINER}</p>}
                >
                  <button type="button" aria-label="What this score measures" className="inline-flex text-muted-foreground hover:text-foreground cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Info size={13} strokeWidth={2} aria-hidden />
                  </button>
                </HoverCard>
              </div>
            ) : (
              // A check from before the 0–10 score: the counts are the result
              // (the card's title already says it's the fit check).
              <p className="text-[14px] font-semibold text-foreground tabular-nums">{fit.matchedCount} matched · {fit.missingCount} missing</p>
            )}
            {score !== null && band && (
              <p className="text-[12.5px] text-muted-foreground tabular-nums mt-1">
                {fit.matchedCount} matched · {fit.missingCount} missing
              </p>
            )}
          </div>
          {/* Re-running needs the JD; old checks can outlive a missing one. */}
          {hasJd && <Button size="sm" variant="ghost" onClick={onAnalyze} aria-label="Check fit again"><RotateCcw size={13} strokeWidth={2} aria-hidden />Re-run</Button>}
        </div>

        {(session?.summary || fit.summary) && (
          <p className="text-[14px] text-foreground/90 leading-relaxed max-w-[70ch]">{session?.summary || fit.summary}</p>
        )}

        {isPending && !session ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        ) : session && (
          <>
            {(strengths.length > 0 || gaps.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-5">
                {strengths.length > 0 && (
                  <div>
                    <SubHeading>Strengths</SubHeading>
                    <ul className="space-y-3">
                      {strengths.map((s, i) => (
                        <li key={i}>
                          <p className="text-[13.5px] text-foreground leading-snug">{s.point}</p>
                          {s.evidence && (
                            <p className="mt-1 pl-2.5 border-l-2 border-border text-[12.5px] text-muted-foreground leading-snug">{s.evidence}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div>
                    <SubHeading>Gaps</SubHeading>
                    <ul className="space-y-3">
                      {gaps.map((g, i) => (
                        <li key={i} className="text-[13.5px] text-foreground leading-snug">
                          {g.point}
                          {g.severity === "major" && (
                            <span className="ml-1.5 inline-block align-[1px] text-[10.5px] font-medium leading-4 px-1.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-200">
                              Major
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {(session.matchedSkills.length > 0 || session.missingSkills.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-5">
                {session.matchedSkills.length > 0 && (
                  <div>
                    <SubHeading>Matched skills</SubHeading>
                    <Chips items={session.matchedSkills} tone="match" />
                  </div>
                )}
                {session.missingSkills.length > 0 && (
                  <div>
                    <SubHeading>Missing skills</SubHeading>
                    <Chips items={session.missingSkills} tone="gap" />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {shownChanges.length > 0 && (
          <div>
            <SubHeading>What to change</SubHeading>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {shownChanges.map((c, i) => (
                <li key={i} className="px-3.5 py-2.5">
                  <p className="text-[12.5px] font-medium text-foreground leading-snug">
                    {CHANGE_SECTION[c.section] ?? c.section}{c.target ? ` · ${c.target}` : ""}
                  </p>
                  <p className="text-[13px] text-foreground/90 leading-snug mt-0.5">{c.change}</p>
                  {c.why && <p className="text-[12px] text-muted-foreground mt-0.5">{c.why}</p>}
                </li>
              ))}
            </ul>
            {changes.length > 3 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                {showAll ? "Show fewer" : `Show all ${changes.length} changes`}
              </button>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <div>
            <SubHeading>What to change</SubHeading>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {shown.map((s, i) => (
                <li key={i} className="px-3.5 py-2.5">
                  <p className="text-[13px] text-foreground leading-snug">{s.suggested}</p>
                  {s.rationale && <p className="text-[12px] text-muted-foreground mt-0.5">{s.rationale}</p>}
                  <p className="text-[11px] text-muted-foreground/80 mt-1 capitalize">{s.section} · {s.kind}</p>
                </li>
              ))}
            </ul>
            {suggestions.length > 3 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                {showAll ? "Show fewer" : `Show all ${suggestions.length} suggestions`}
              </button>
            )}
          </div>
        )}

        <div className="pt-1">
          <Button variant="primary" onClick={onTailor}>Tailor your resume <ArrowRight size={14} strokeWidth={2} aria-hidden /></Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="fit-heading" className="rounded-xl border border-border bg-card p-5" id="fit">
      <h2 id="fit-heading" className="text-[13px] font-semibold text-foreground mb-4">Fit check</h2>
      {body}
    </section>
  );
}
