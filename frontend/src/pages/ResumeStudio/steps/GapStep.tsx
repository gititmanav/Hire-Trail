/** Step 1 — "See the gap". Keyword-coverage gauge + matched/missing chips +
 *  per-section flags, all from the tailor gap analysis. A collapsible JD lets
 *  the user re-analyze against a different posting. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, KeyRound, RotateCcw } from "lucide-react";
import AiPulse from "../../../components/AiIndicator/AiPulse.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import type { StudioController } from "../useStudioDocument.ts";
import type { SectionFlag } from "../../../utils/resumeDocument.ts";

function CoverageRing({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative" style={{ width: 150, height: 150 }}>
      <svg width={150} height={150} viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">{Math.round(pct)}%</span>
        <span className="text-[10px] font-medium text-muted-foreground mt-0.5">keyword match</span>
      </div>
    </div>
  );
}

const FLAG_META: Record<SectionFlag["severity"], { icon: typeof CheckCircle2; cls: string; ring: string }> = {
  good: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", ring: "border-emerald-300/60 dark:border-emerald-900/50" },
  warn: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400", ring: "border-amber-300/60 dark:border-amber-900/50" },
  gap: { icon: Circle, cls: "text-red-500", ring: "border-red-300/60 dark:border-red-900/50" },
};

export default function GapStep({ studio }: { studio: StudioController }) {
  const { gap, gapLoading, gapError, jd, setJd, reanalyzeGap } = studio;
  const { requireRealAccount } = useDemoGate();
  // Open the JD by default until a gap exists, so the user sees where to paste
  // and the "Analyze gap" trigger without hunting for it.
  const [jdOpen, setJdOpen] = useState(!gap);

  const runAnalyze = () => {
    if (!requireRealAccount("AI gap analysis")) return;
    reanalyzeGap();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">See the gap</h2>
        <p className="text-sm text-muted-foreground mt-1">How well your resume matches the role today — before you tailor it.</p>
      </div>

      {/* Fail-in-place: an AI failure shows a reason + Retry (+ Add a key) here,
          never a silent no-op or a perpetual spinner. */}
      {gapError && (
        <div className="bg-card border border-red-300/60 dark:border-red-900/50 rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} strokeWidth={2} className="text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Couldn't analyze the gap</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{gapError.message}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={runAnalyze}
                  disabled={gapLoading || jd.trim().length < 20}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <RotateCcw size={13} strokeWidth={2} /> {gapLoading ? "Retrying…" : "Retry"}
                </button>
                {gapError.isKeyIssue && (
                  <Link to="/settings/ai" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg">
                    <KeyRound size={13} strokeWidth={2} /> Add a key
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {gapLoading && !gap ? (
        <div className="bg-card border border-border rounded-xl p-10 flex items-center justify-center">
          <AiPulse size={20} label="Analyzing the gap…" />
        </div>
      ) : gap ? (
        <>
          {/* Coverage + matched/missing */}
          <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="flex justify-center">
              <CoverageRing pct={gap.coverage} />
            </div>
            <div className="space-y-4 min-w-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1.5">Matched ({gap.matched.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {gap.matched.map((k) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">{k}</span>
                  ))}
                  {gap.matched.length === 0 && <span className="text-xs text-muted-foreground">None detected yet.</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1.5">Missing ({gap.missing.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {gap.missing.map((k) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">{k}</span>
                  ))}
                  {gap.missing.length === 0 && <span className="text-xs text-muted-foreground">Nothing major — nice.</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Per-section flags */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Section-by-section</h3>
            <ul className="space-y-2">
              {gap.sectionFlags.map((f) => {
                const m = FLAG_META[f.severity];
                const Icon = m.icon;
                return (
                  <li key={f.sectionId} className={`flex items-start gap-2.5 rounded-lg border ${m.ring} bg-background p-3`}>
                    <Icon size={16} strokeWidth={2} className={`${m.cls} mt-0.5 shrink-0`} fill={f.severity === "gap" ? "currentColor" : "none"} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.note}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : !gapError ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Paste the target job description below and press <span className="font-medium text-foreground">Analyze gap</span> to see how your resume matches.
        </div>
      ) : null}

      {/* JD (collapsible) */}
      <div className="bg-card border border-border rounded-xl">
        <button onClick={() => setJdOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-medium text-foreground">Target job description</span>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${jdOpen ? "rotate-180" : ""}`} />
        </button>
        {jdOpen && (
          <div className="px-4 pb-4">
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={6}
              placeholder="Paste the job description to analyze against…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring resize-y leading-relaxed"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={runAnalyze}
                disabled={gapLoading || jd.trim().length < 20}
                title={jd.trim().length < 20 ? "Paste a job description (20+ chars) to analyze" : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gapLoading ? "Analyzing…" : gap ? "Re-analyze" : "Analyze gap"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
