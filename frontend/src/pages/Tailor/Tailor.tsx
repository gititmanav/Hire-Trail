/** Tailor page — paste/scrape a JD, get fit score + actionable suggestions,
 *  accept/reject each, then generate a tailored PDF (export in next iteration). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { tailorAPI, applicationsAPI, authAPI, resumesAPI } from "../../utils/api.ts";
import type { TailorSession, TailorSuggestion, TailorDecision } from "../../utils/api.ts";
import { useBackgroundTasks } from "../../hooks/useBackgroundTasks.tsx";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import type { Application, Resume } from "../../types";

/** Soft warning at this length — the input still works, we just nudge the user.
 *  Most real JDs are well under 25k. Above this, the analyzer's prompt size
 *  starts to dominate cost and the LLM's signal-to-noise drops. */
const JD_SOFT_LIMIT = 25_000;
/** Hard block. Backend silently truncates at 30k server-side; we cap input at
 *  50k so a user pasting an entire careers page doesn't see a confusing
 *  truncated analysis. */
const JD_HARD_LIMIT = 50_000;

const GRADE_TONE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700",
  B: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border-sky-300 dark:border-sky-700",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-300 dark:border-orange-700",
  F: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-red-300 dark:border-red-700",
};

const SECTION_LABEL: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  project: "Project",
  skills: "Skills",
};

const KIND_TONE: Record<string, string> = {
  rewrite: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  add: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  reorder: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  emphasize: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

/** Poll a TailorSession every 2s (capped at ~3 min) until status flips out of "processing". */
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 90;

/** localStorage key for the last session the user was viewing — used to restore the
 *  result view when they navigate back to /tailor without a ?session= param. Cleared
 *  when the user explicitly clicks "Analyze another". */
const LAST_SESSION_STORAGE_KEY = "hiretrail:tailor:last-session";

async function pollTailorSession(sessionId: string): Promise<TailorSession> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const s = await tailorAPI.get(sessionId);
    if (s.status !== "processing") return s;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Analysis is taking longer than expected. Refresh later to see the result.");
}

export default function Tailor() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session");
  const { startTask, tasks, registerRecovery } = useBackgroundTasks();
  const { requireRealAccount } = useDemoGate();

  const [jd, setJd] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [session, setSession] = useState<TailorSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [linkedApp, setLinkedApp] = useState<Application | null>(null);
  const [recentSessions, setRecentSessions] = useState<TailorSession[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [markAppliedOpen, setMarkAppliedOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);
  // Page shows "Analyzing…" on the button when a tailor_analyze task is running,
  // regardless of whether this component started it.
  const analyzing = tasks.some((t) => t.kind === "tailor_analyze" && t.status === "running");

  // Restore the last session from localStorage when landing on /tailor with no
  // ?session= param — so navigating away and coming back doesn't drop you into a
  // blank input form. Cleared only by an explicit "Analyze another" click.
  useEffect(() => {
    if (sessionId) return;
    try {
      const last = localStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (last) setParams({ session: last }, { replace: true });
    } catch { /* localStorage disabled — fall through to input form */ }
    // setParams is stable; intentionally only re-runs when sessionId flips to null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Load existing session if ?session=... was supplied (e.g. from the extension or sidebar history).
  useEffect(() => {
    if (!sessionId) { setSession(null); setLinkedApp(null); return; }
    setLoadingSession(true);
    setLinkedApp(null);
    tailorAPI.get(sessionId)
      .then((s) => {
        setSession(s);
        setJd(s.jobDescription || "");
        setTitle(s.jobTitle || "");
        setCompany(s.company || "");
        setUrl(s.jobUrl || "");
        // Only persist *non-failed* sessions as "last session". A failed session
        // saved here would cause the next "Try a new analysis" click to restore
        // the same broken state from localStorage — the user gets trapped.
        try {
          if (s.status === "failed") {
            localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
          } else {
            localStorage.setItem(LAST_SESSION_STORAGE_KEY, s._id);
          }
        } catch { /* ignore */ }
        // Fetch the linked Drafting application — we need its stage to decide whether
        // to show the "Mark as Applied" button.
        if (s.applicationId) {
          applicationsAPI.getOne(s.applicationId)
            .then((a) => setLinkedApp(a))
            .catch(() => setLinkedApp(null));
        }
      })
      .catch(() => {
        toast.error("Could not load tailor session");
        try { localStorage.removeItem(LAST_SESSION_STORAGE_KEY); } catch { /* ignore */ }
      })
      .finally(() => setLoadingSession(false));
  }, [sessionId]);

  // Recent sessions list for the dropdown (fetched once + after any new session creation).
  const loadRecent = useCallback(() => {
    tailorAPI.list(30)
      .then((list) => setRecentSessions(list))
      .catch(() => { /* dropdown stays empty — non-blocking */ });
  }, []);
  useEffect(() => { void loadRecent(); }, [loadRecent, sessionId]);

  // Click-outside + Escape close the Recent sessions dropdown.
  useEffect(() => {
    if (!recentOpen) return;
    const onClick = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) setRecentOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRecentOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [recentOpen]);

  // Keep the page view in sync while a session is still being analyzed.
  // (The global task card polls too — this just updates the in-page state so the
  // result view appears the moment it's ready without manual refresh.)
  useEffect(() => {
    if (!session || session.status !== "processing") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await tailorAPI.get(session._id);
        if (cancelled) return;
        if (fresh.status !== "processing") setSession(fresh);
      } catch { /* poll error: silent, retry on next tick */ }
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session]);

  const onAnalyze = useCallback(() => {
    if (!requireRealAccount("AI Tailor")) return;
    if (jd.trim().length < 50) {
      toast.error("Paste the full job description (at least a few sentences).");
      return;
    }
    if (jd.length > JD_HARD_LIMIT) {
      toast.error(`Job description is over ${JD_HARD_LIMIT.toLocaleString()} characters. Trim it before analyzing.`);
      return;
    }
    const jdSnapshot = jd.trim();
    const titleSnapshot = title.trim();
    const companySnapshot = company.trim();
    const urlSnapshot = url.trim();
    const cardSublabel = titleSnapshot || companySnapshot || undefined;

    startTask<TailorSession>({
      kind: "tailor_analyze",
      label: "Analyzing job description",
      sublabel: cardSublabel,
      run: async ({ setRecovery }) => {
        // 1. Create the session up front; backend returns id immediately.
        const created = await tailorAPI.analyze({
          jobDescription: jdSnapshot,
          jobTitle: titleSnapshot,
          company: companySnapshot,
          url: urlSnapshot,
        });
        // Persist recovery hint now that we know the session id — a refresh
        // from this moment forward will resume polling.
        setRecovery({ resourceId: created._id });
        // Reflect the in-flight session in the page url right away.
        setSession(created);
        setParams({ session: created._id });
        // 2. Poll until status flips.
        return pollTailorSession(created._id);
      },
      onResult: (s) => {
        if (s.status === "failed") {
          return { successLabel: s.errorMessage || "Analysis failed." };
        }
        return {
          successLabel: `Analyzed — fit ${s.fitScore}/5 (${s.fitGrade})`,
          ctaLabel: "View",
          ctaPath: `/tailor?session=${s._id}`,
        };
      },
      onSettled: (r) => {
        if (r.ok && r.data.status === "succeeded") {
          setSession(r.data);
          setParams({ session: r.data._id });
        } else if (r.ok && r.data.status === "failed") {
          toast.error(r.data.errorMessage || "Analysis failed.");
        } else if (!r.ok) {
          const msg = ((r.error as { response?: { data?: { error?: string } } })?.response?.data?.error) || "Analysis failed.";
          toast.error(msg);
        }
      },
    });
  }, [jd, title, company, url, startTask, setParams, requireRealAccount]);

  // Recovery handler: after a page refresh, the provider replays any persisted
  // recovery entries against the kind we register here.
  useEffect(() => {
    return registerRecovery({
      kind: "tailor_analyze",
      rebuild: (recovery, label, sublabel) => ({
        kind: "tailor_analyze",
        label,
        sublabel,
        run: () => pollTailorSession(recovery.resourceId),
        onResult: (s) => {
          const session = s as TailorSession;
          if (session.status === "failed") {
            return { successLabel: session.errorMessage || "Analysis failed." };
          }
          return {
            successLabel: `Analyzed — fit ${session.fitScore}/5 (${session.fitGrade})`,
            ctaLabel: "View",
            ctaPath: `/tailor?session=${session._id}`,
          };
        },
        // Don't repeat onSettled side effects — the user may be anywhere in the app.
      }),
    });
  }, [registerRecovery]);

  const setDecision = useCallback(async (index: number, decision: TailorDecision) => {
    if (!session) return;
    const prev = session.suggestions[index].decision;
    // optimistic
    setSession({
      ...session,
      suggestions: session.suggestions.map((s, i) => (i === index ? { ...s, decision } : s)),
    });
    try {
      const updated = await tailorAPI.setDecision(session._id, index, decision);
      setSession(updated);
    } catch {
      toast.error("Could not save decision");
      // revert
      setSession({
        ...session,
        suggestions: session.suggestions.map((s, i) => (i === index ? { ...s, decision: prev } : s)),
      });
    }
  }, [session]);

  const acceptedCount = useMemo(
    () => session?.suggestions.filter((s) => s.decision === "accepted").length ?? 0,
    [session]
  );
  const decidedCount = useMemo(
    () => session?.suggestions.filter((s) => s.decision !== null).length ?? 0,
    [session]
  );

  /* ---------- empty / input state ---------- */
  if (!session && !loadingSession) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-foreground">Tailor a resume</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">Beta</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Paste a job description. We'll compare it against your master profile and surface a fit score plus a punch list of specific, accept-or-reject suggestions.
        </p>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Company (optional)</label>
              <input className="input-premium" placeholder="e.g. Stripe" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Role title (optional)</label>
              <input className="input-premium" placeholder="e.g. Senior Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Job URL (optional)</label>
              <input className="input-premium" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Job description *</label>
            <textarea
              className={`input-premium min-h-[260px] resize-y font-mono text-xs leading-relaxed ${
                jd.length > JD_HARD_LIMIT ? "border-red-400 dark:border-red-700" : ""
              }`}
              placeholder="Paste the full job description here…"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              aria-invalid={jd.length > JD_HARD_LIMIT || undefined}
            />
            {jd.length > JD_HARD_LIMIT ? (
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                {jd.length.toLocaleString()} chars · over the {JD_HARD_LIMIT.toLocaleString()}-char hard limit. Trim it to analyze.
              </p>
            ) : jd.length > JD_SOFT_LIMIT ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                {jd.length.toLocaleString()} chars · most JDs are under {JD_SOFT_LIMIT.toLocaleString()}. We&rsquo;ll trim to {JD_HARD_LIMIT.toLocaleString()} when analyzing.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">{jd.length.toLocaleString()} chars</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzing || jd.trim().length < 50 || jd.length > JD_HARD_LIMIT}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
            >
              {analyzing ? "Analyzing…" : "Analyze JD"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingSession) {
    return <div className="max-w-4xl mx-auto"><p className="text-sm text-muted-foreground">Loading session…</p></div>;
  }

  /* ---------- processing / failed states ---------- */
  if (session && session.status === "processing") {
    return (
      <div className="max-w-2xl mx-auto pt-16 text-center">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
          <svg className="animate-spin" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Analyzing your job description…</h1>
        <p className="text-sm text-muted-foreground">
          {session.jobTitle || session.company
            ? <>For {session.jobTitle ? <strong>{session.jobTitle}</strong> : null}{session.jobTitle && session.company ? " at " : ""}{session.company ? <strong>{session.company}</strong> : null}.</>
            : null}
          {" "}This usually takes 10&ndash;30 seconds. Feel free to navigate elsewhere — we'll keep working in the background and pop a notification when it's ready.
        </p>
      </div>
    );
  }

  if (session && session.status === "failed") {
    return (
      <div className="max-w-2xl mx-auto pt-12">
        <div className="rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-900/20 p-5">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">Analysis failed</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{session.errorMessage || "Something went wrong."}</p>
          <button
            type="button"
            onClick={() => {
              // Clear the persisted last-session before unsetting params, so the
              // sessionId=null effect below doesn't immediately restore the URL
              // back to this same failed session. (Was the root cause of the
              // "Try again does nothing" trap.)
              try { localStorage.removeItem(LAST_SESSION_STORAGE_KEY); } catch { /* ignore */ }
              setParams({});
              setSession(null);
            }}
            className="mt-4 px-3 py-1.5 text-xs font-medium border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            Try a new analysis
          </button>
        </div>
      </div>
    );
  }

  /* ---------- result view ---------- */
  return (
    <div className="tailor-page w-full">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground truncate">
                {session!.jobTitle || "Untitled role"}{session!.company ? ` · ${session!.company}` : ""}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">Beta</span>
              {linkedApp?.stage === "Drafting" && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 shrink-0">Drafting</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {session!.provider}:{session!.modelId} · {new Date(session!.createdAt).toLocaleString()}
            </p>
          </div>
          <RecentSessionsDropdown
            sessions={recentSessions}
            currentId={session!._id}
            open={recentOpen}
            onToggle={() => setRecentOpen((o) => !o)}
            onSelect={(id) => { setRecentOpen(false); setParams({ session: id }); }}
            rootRef={recentRef}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {linkedApp?.stage === "Drafting" && session!.status === "succeeded" && (
            <button
              type="button"
              onClick={() => setMarkAppliedOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
              title="You've drafted this — confirm you applied"
            >
              Mark as Applied
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              try { localStorage.removeItem(LAST_SESSION_STORAGE_KEY); } catch { /* ignore */ }
              setParams({});
              setSession(null);
              setLinkedApp(null);
              setJd(""); setTitle(""); setCompany(""); setUrl("");
            }}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted"
          >
            Analyze another
          </button>
        </div>
      </div>

      {markAppliedOpen && linkedApp && (
        <MarkAppliedModal
          session={session!}
          onClose={() => setMarkAppliedOpen(false)}
          onApplied={(updatedApp) => {
            setMarkAppliedOpen(false);
            setLinkedApp(updatedApp);
            void loadRecent();
            toast.success(`Marked as applied · ${updatedApp.company}`);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* ===== Main column: suggestions ===== */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-foreground">Suggestions</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {session!.suggestions.length === 0
                  ? "No actionable changes — your profile already aligns."
                  : `${decidedCount} of ${session!.suggestions.length} reviewed · ${acceptedCount} accepted`}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const { blob, pages, warnings } = await tailorAPI.generatePdf(session!._id);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const baseName = `${session!.company || "resume"}-${session!.jobTitle || "tailored"}`
                    .replace(/[^a-zA-Z0-9-]+/g, "_").slice(0, 60) || "resume";
                  a.download = `hiretrail-${baseName}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  if (warnings.length) warnings.forEach((w) => toast(w, { icon: "⚠️" }));
                  else toast.success(`PDF downloaded (${pages} page${pages > 1 ? "s" : ""}).`);
                } catch (err) {
                  const e = err as { response?: { data?: { error?: string } }; message?: string };
                  toast.error(e?.response?.data?.error || e?.message || "PDF generation failed.");
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
              title="Generate tailored PDF"
            >
              Generate PDF
            </button>
          </div>

          {session!.suggestions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No suggestions returned. The model thinks your profile already covers this JD.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {session!.suggestions.map((s, i) => (
                <SuggestionRow
                  key={i}
                  suggestion={s}
                  onAccept={() => setDecision(i, s.decision === "accepted" ? null : "accepted")}
                  onReject={() => setDecision(i, s.decision === "rejected" ? null : "rejected")}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ===== Right sidebar: fit + skills + JD ===== */}
        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Fit</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-14 h-14 rounded-xl border flex items-center justify-center text-2xl font-bold ${GRADE_TONE[session!.fitGrade] || GRADE_TONE.C}`}>
                {session!.fitGrade}
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">{session!.fitScore} / 5</p>
                <p className="text-xs text-muted-foreground">{session!.fitGrade}-grade match</p>
              </div>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{session!.summary}</p>
          </div>

          {session!.matchedSkills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">Matched skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {session!.matchedSkills.map((s) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}

          {session!.missingSkills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">Missing from your profile</h3>
              <div className="flex flex-wrap gap-1.5">
                {session!.missingSkills.map((s) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}

          <details className="bg-card border border-border rounded-xl">
            <summary className="px-4 py-3 cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
              Job description
            </summary>
            <div className="px-4 pb-4 text-xs text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
              {session!.jobDescription}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

/* ---------- per-row component ---------- */

function SuggestionRow({
  suggestion, onAccept, onReject,
}: {
  suggestion: TailorSuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const accepted = suggestion.decision === "accepted";
  const rejected = suggestion.decision === "rejected";
  return (
    <li className={`px-6 py-5 transition-colors ${
      accepted ? "bg-emerald-50/50 dark:bg-emerald-900/10" :
      rejected ? "bg-muted/50 opacity-70" : ""
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 font-semibold uppercase tracking-wider rounded bg-muted text-foreground">
            {SECTION_LABEL[suggestion.section] || suggestion.section}
          </span>
          <span className={`text-[11px] px-2 py-0.5 font-semibold uppercase tracking-wider rounded ${KIND_TONE[suggestion.kind] || ""}`}>
            {suggestion.kind}
          </span>
          {suggestion.targetCompanyOrName && (
            <span className="text-sm text-muted-foreground">→ {suggestion.targetCompanyOrName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onReject}
            className={`px-3 py-1.5 text-sm font-medium border rounded-md ${
              rejected
                ? "bg-foreground/10 border-foreground/30 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {rejected ? "Rejected" : "Reject"}
          </button>
          <button
            onClick={onAccept}
            className={`px-3 py-1.5 text-sm font-medium border rounded-md ${
              accepted
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-border text-muted-foreground hover:text-emerald-700 hover:border-emerald-300"
            }`}
          >
            {accepted ? "Accepted" : "Accept"}
          </button>
        </div>
      </div>

      {suggestion.targetBullet && (
        <div className="text-sm text-muted-foreground mb-1.5">
          <span className="font-semibold mr-1">Replaces:</span>
          <span className="line-through">{suggestion.targetBullet}</span>
        </div>
      )}
      <p className="text-[15px] text-foreground leading-relaxed">{suggestion.suggested}</p>
      {suggestion.rationale && (
        <div className="mt-3 flex items-start gap-2 pl-3 border-l-2 border-primary/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary mt-0.5 shrink-0">Why</span>
          <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.rationale}</p>
        </div>
      )}
      {suggestion.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {suggestion.tags.map((t) => (
            <span key={t} className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded">{t}</span>
          ))}
        </div>
      )}
    </li>
  );
}

/* ---------- Recent sessions dropdown ---------- */

function RecentSessionsDropdown({
  sessions, currentId, open, onToggle, onSelect, rootRef,
}: {
  sessions: TailorSession[];
  currentId: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  rootRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Recent tailor sessions"
      >
        Recent
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="4,6 8,10 12,6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[320px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-lg shadow-lg z-40 overflow-hidden">
          <ul className="max-h-[340px] overflow-y-auto">
            {sessions.map((s) => {
              const isCurrent = s._id === currentId;
              const fitText =
                s.status === "processing" ? "Analyzing…" :
                s.status === "failed" ? "Failed" :
                s.fitGrade ? `${s.fitGrade}-grade · ${s.fitScore}/5` : "—";
              const statusTone =
                s.status === "processing" ? "text-primary" :
                s.status === "failed" ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground";
              return (
                <li key={s._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s._id)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted/60 ${isCurrent ? "bg-primary/5" : ""}`}
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.jobTitle || "Untitled role"}{s.company ? ` · ${s.company}` : ""}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${statusTone}`}>
                      {fitText} · {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Mark as Applied modal ---------- */

function MarkAppliedModal({
  session, onClose, onApplied,
}: {
  session: TailorSession;
  onClose: () => void;
  onApplied: (app: Application) => void;
}) {
  const [primaryResume, setPrimaryResume] = useState<Resume | null>(null);
  const [loadingPrimary, setLoadingPrimary] = useState(true);
  const [choice, setChoice] = useState<"primary" | "tailored">("tailored");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authAPI.getMe();
        if (cancelled) return;
        if (me.primaryResumeId) {
          try {
            const all = await resumesAPI.getAll();
            if (cancelled) return;
            setPrimaryResume(all.find((r) => r._id === me.primaryResumeId) ?? null);
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setLoadingPrimary(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await tailorAPI.markApplied(session._id, choice);
      onApplied(result.application);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error || e?.message || "Could not mark as applied.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="w-full max-w-[480px] bg-card border border-border rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Which resume did you send?</p>
          <p className="text-xs text-muted-foreground mt-1">
            {session.company || "This application"}{session.jobTitle ? ` · ${session.jobTitle}` : ""}
          </p>
        </div>

        <div className="p-5 space-y-2">
          <ChoiceRow
            label="The tailored version from this session"
            sublabel="Will be saved to your Resumes under a 'Tailored' section so you can reference it later."
            checked={choice === "tailored"}
            onSelect={() => setChoice("tailored")}
            disabled={session.status !== "succeeded"}
            disabledHint={session.status !== "succeeded" ? "Wait for analysis to finish first." : undefined}
          />
          <ChoiceRow
            label={primaryResume ? `My primary resume — ${primaryResume.name}` : "My primary resume"}
            sublabel={loadingPrimary ? "Loading…" : primaryResume ? "Won't add a new entry to your Resumes." : "No primary resume set."}
            checked={choice === "primary"}
            onSelect={() => setChoice("primary")}
            disabled={loadingPrimary || !primaryResume}
          />
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium border border-border rounded-md text-foreground hover:bg-muted" disabled={submitting}>
            Cancel
          </button>
          <button type="button" onClick={submit} className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50" disabled={submitting || (choice === "primary" && !primaryResume) || (choice === "tailored" && session.status !== "succeeded")}>
            {submitting ? "Marking…" : "Mark as Applied"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceRow({
  label, sublabel, checked, onSelect, disabled, disabledHint,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed border-border" :
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      }`}
      disabled={disabled}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
            checked ? "border-primary" : "border-muted-foreground/40"
          }`}
          aria-hidden
        >
          {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{disabledHint || sublabel}</p>
        </div>
      </div>
    </button>
  );
}
