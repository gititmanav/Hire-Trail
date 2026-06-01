/**
 * Read-only slide-in sidebar showing the full AI Tailor analysis for one
 * application. Fetches the full TailorSession by id, shows grade, summary,
 * matched/missing skills, and the suggestion list. CTA at the bottom links
 * to /tailor?session=... for the full accept/reject flow.
 *
 * Why read-only here: the Tailor page already has the canonical edit surface,
 * and v1 of the AI panel only needs to surface "here's what we found."
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Sparkle, ArrowRight } from "lucide-react";
import AiPulse from "../../components/AiIndicator/AiPulse.tsx";
import { tailorAPI } from "../../utils/api.ts";
import type { TailorSession } from "../../utils/api.ts";

const GRADE_TONE: Record<string, { bg: string; ring: string; label: string }> = {
  A: { bg: "from-emerald-500/15 to-emerald-500/5", ring: "ring-emerald-300/60", label: "Strong match" },
  B: { bg: "from-sky-500/15 to-sky-500/5",         ring: "ring-sky-300/60",     label: "Good match" },
  C: { bg: "from-amber-500/15 to-amber-500/5",     ring: "ring-amber-300/60",   label: "Mixed match" },
  D: { bg: "from-orange-500/15 to-orange-500/5",   ring: "ring-orange-300/60",  label: "Weak match" },
  F: { bg: "from-red-500/15 to-red-500/5",         ring: "ring-red-300/60",     label: "Wrong track" },
};

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function AiAnalysisSidebar({ sessionId, onClose }: Props) {
  const [session, setSession] = useState<TailorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);

  const finishClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tailorAPI.get(sessionId)
      .then((s) => { if (!cancelled) setSession(s); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Failed to load analysis"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") finishClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [finishClose]);

  const grade = session?.fitGrade || "";
  const tone = GRADE_TONE[grade] ?? { bg: "from-muted to-muted/40", ring: "ring-border", label: "Analyzed" };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={finishClose}>
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative h-full w-[480px] max-w-[100vw] bg-card shadow-2xl flex flex-col border-l border-border transition-transform duration-200 motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI fit analysis"
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex w-6 h-6 items-center justify-center rounded-md text-white"
              style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)" }}
              aria-hidden
            >
              <Sparkle size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-base font-semibold text-foreground">AI Fit Analysis</h2>
          </div>
          <button
            onClick={finishClose}
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-xl bg-muted animate-pulse" />
              <div className="h-3 rounded bg-muted animate-pulse w-3/4" />
              <div className="h-3 rounded bg-muted animate-pulse w-2/3" />
              <div className="h-32 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !session ? (
            <p className="text-sm text-muted-foreground">No analysis yet.</p>
          ) : session.status === "processing" ? (
            <AiPulse size={15} label="Analyzing this JD against your profile…" labelSize={14} />
          ) : session.status === "failed" || session.status === "deferred" ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              {session.errorMessage || "Analysis is not available yet."}
            </div>
          ) : (
            <>
              {/* Header card */}
              <div className={`rounded-xl border border-border bg-gradient-to-br ${tone.bg} p-4 flex items-center gap-4`}>
                <div className={`w-14 h-14 rounded-xl bg-card ring-1 ring-inset ${tone.ring} flex items-center justify-center text-[28px] font-bold tracking-tight text-foreground`}>
                  {grade || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground">{tone.label}</p>
                  <p className="text-[12px] text-muted-foreground tabular-nums">
                    Score {session.fitScore}/5 ·{" "}
                    {session.matchedSkills.length} matched · {session.missingSkills.length} gap{session.missingSkills.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {/* Summary */}
              {session.summary && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</h3>
                  <p className="text-[13.5px] text-foreground leading-relaxed">{session.summary}</p>
                </section>
              )}

              {/* Matched */}
              {session.matchedSkills.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Matched skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {session.matchedSkills.map((k) => (
                      <span key={k} className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50">
                        {k}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Missing */}
              {session.missingSkills.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Skill gaps</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {session.missingSkills.map((k) => (
                      <span key={k} className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50">
                        {k}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Suggestions */}
              {session.suggestions.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tailor suggestions</h3>
                  <ul className="space-y-2">
                    {session.suggestions.slice(0, 6).map((s, i) => (
                      <li key={i} className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{s.section}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-secondary-foreground">{s.kind}</span>
                        </div>
                        <p className="text-[12.5px] text-foreground leading-snug">{s.suggested}</p>
                        {s.rationale && (
                          <p className="text-[11px] text-muted-foreground italic mt-1">{s.rationale}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {session && session.status === "succeeded" && (
          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex items-center justify-end gap-2">
            <Link
              to={`/tailor?session=${session._id}`}
              className="btn-accent inline-flex items-center gap-1.5"
            >
              Open full Tailor
              <ArrowRight size={13} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
