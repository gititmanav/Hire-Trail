/** AI fit analysis, inline on the application page (replaces the separate
 *  slide-over). Every state is designed: no job description, never analysed,
 *  analysing (glow-pulse — never a spinner), failed, and the result. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RotateCcw } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import Button from "../../../components/ui/Button.tsx";
import { tailorAPI } from "../../../utils/api.ts";
import { hasJobDescription } from "../../../utils/applicationFields.ts";
import type { Application } from "../../../types";

const GRADE: Record<string, { label: string; tile: string }> = {
  A: { label: "Strong match", tile: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/60" },
  B: { label: "Good match", tile: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800/60" },
  C: { label: "Mixed match", tile: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/60" },
  D: { label: "Weak match", tile: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800/60" },
  F: { label: "Wrong track", tile: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/60" },
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

export default function FitSection({ app, onAnalyze, analyzing, onTailor }: {
  app: Application;
  onAnalyze: () => void;
  analyzing: boolean;
  onTailor: () => void;
}) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const fit = app.fit;
  const sessionId = fit?.sessionId || app.tailorSessionId || "";
  const { data: session, isPending } = useQuery({
    // Keyed on status so a finished analysis refetches the full session.
    queryKey: ["tailor-session", sessionId, fit?.status],
    queryFn: () => tailorAPI.get(sessionId),
    enabled: !!sessionId && fit?.status === "succeeded",
    staleTime: 5 * 60_000,
  });

  const hasJd = hasJobDescription(app);
  let body: React.ReactNode;

  // Order matters: an existing result always shows (older analyses exist for
  // applications whose JD was never saved); "add a JD" only when there's
  // nothing to show and nothing to run the analysis on.
  if (fit?.status === "processing" || analyzing) {
    body = <AiPulse size={15} label="Analyzing this role against your profile…" labelSize={13.5} />;
  } else if (fit?.status === "succeeded") {
    body = null; // rendered below
  } else if (!hasJd) {
    body = (
      <p className="text-[13.5px] text-muted-foreground max-w-lg">
        Add the job description below and HireTrail will grade how well your profile fits this role — matched skills, gaps, and what to change.
      </p>
    );
  } else if (!fit) {
    body = (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13.5px] text-muted-foreground max-w-md">See how your profile stacks up against this posting before you tailor anything.</p>
        <Button size="sm" variant="primary" onClick={onAnalyze}>Analyze fit</Button>
      </div>
    );
  } else {
    body = (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13.5px] text-muted-foreground max-w-lg">{fit.errorMessage || "The analysis didn't finish."}</p>
        <Button size="sm" onClick={onAnalyze}><RotateCcw size={13} strokeWidth={2} aria-hidden />Retry</Button>
      </div>
    );
  }
  if (fit?.status === "succeeded" && !analyzing) {
    const grade = GRADE[fit.fitGrade] ?? { label: "Analyzed", tile: "bg-muted text-foreground ring-border" };
    const suggestions = session?.suggestions ?? [];
    const shown = showAllSuggestions ? suggestions : suggestions.slice(0, 3);
    body = (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl ring-1 ring-inset flex items-center justify-center text-[26px] font-semibold ${grade.tile}`}>
            {fit.fitGrade || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">{grade.label}</p>
            <p className="text-[12.5px] text-muted-foreground tabular-nums">
              Score {fit.fitScore}/5 · {fit.matchedCount} matched · {fit.missingCount} gap{fit.missingCount === 1 ? "" : "s"}
            </p>
          </div>
          {/* Re-running needs the JD; old analyses can outlive a missing one. */}
          {hasJd && <Button size="sm" variant="ghost" onClick={onAnalyze} aria-label="Re-run analysis"><RotateCcw size={13} strokeWidth={2} aria-hidden />Re-run</Button>}
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
          <div className="grid sm:grid-cols-2 gap-5">
            {session.matchedSkills.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-2">Matched skills</h4>
                <Chips items={session.matchedSkills} tone="match" />
              </div>
            )}
            {session.missingSkills.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground mb-2">Gaps to address</h4>
                <Chips items={session.missingSkills} tone="gap" />
              </div>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <div>
            <h4 className="text-[12px] font-medium text-muted-foreground mb-2">What to change</h4>
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
              <button type="button" onClick={() => setShowAllSuggestions((v) => !v)} className="mt-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                {showAllSuggestions ? "Show fewer" : `Show all ${suggestions.length} suggestions`}
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
      <h2 id="fit-heading" className="text-[13px] font-semibold text-foreground mb-4">AI fit</h2>
      {body}
    </section>
  );
}
