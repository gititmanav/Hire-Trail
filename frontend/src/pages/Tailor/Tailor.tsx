/** Tailor page — paste/scrape a JD, get fit score + actionable suggestions,
 *  accept/reject each, then generate a tailored PDF (export in next iteration). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { tailorAPI } from "../../utils/api.ts";
import type { TailorSession, TailorSuggestion, TailorDecision } from "../../utils/api.ts";

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

export default function Tailor() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session");

  const [jd, setJd] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [session, setSession] = useState<TailorSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // Load existing session if ?session=... was supplied (e.g. from the extension or sidebar history).
  useEffect(() => {
    if (!sessionId) { setSession(null); return; }
    setLoadingSession(true);
    tailorAPI.get(sessionId)
      .then((s) => {
        setSession(s);
        setJd(s.jobDescription || "");
        setTitle(s.jobTitle || "");
        setCompany(s.company || "");
        setUrl(s.jobUrl || "");
      })
      .catch(() => toast.error("Could not load tailor session"))
      .finally(() => setLoadingSession(false));
  }, [sessionId]);

  const onAnalyze = useCallback(async () => {
    if (jd.trim().length < 50) {
      toast.error("Paste the full job description (at least a few sentences).");
      return;
    }
    setAnalyzing(true);
    try {
      const s = await tailorAPI.analyze({
        jobDescription: jd.trim(),
        jobTitle: title.trim(),
        company: company.trim(),
        url: url.trim(),
      });
      setSession(s);
      setParams({ session: s._id });
      toast.success(`Analyzed — fit score ${s.fitScore}/5 (${s.fitGrade})`);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string | Record<string, string[]> } }; message?: string };
      const msg = typeof e.response?.data?.error === "string" ? e.response.data.error : e.message || "Analysis failed.";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [jd, title, company, url, setParams]);

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
              className="input-premium min-h-[260px] resize-y font-mono text-xs leading-relaxed"
              placeholder="Paste the full job description here…"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">{jd.length.toLocaleString()} chars</p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzing || jd.trim().length < 50}
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

  /* ---------- result view ---------- */
  return (
    <div className="tailor-page max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground truncate">
              {session!.jobTitle || "Untitled role"}{session!.company ? ` · ${session!.company}` : ""}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {session!.provider}:{session!.modelId} · {new Date(session!.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setParams({}); setSession(null); setJd(""); setTitle(""); setCompany(""); setUrl(""); }}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted"
        >
          Analyze another
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
        {/* ===== Main column: suggestions ===== */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Suggestions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
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
    <li className={`px-5 py-4 transition-colors ${
      accepted ? "bg-emerald-50/50 dark:bg-emerald-900/10" :
      rejected ? "bg-muted/50 opacity-70" : ""
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 font-semibold uppercase tracking-wider rounded bg-muted text-foreground">
            {SECTION_LABEL[suggestion.section] || suggestion.section}
          </span>
          <span className={`text-[10px] px-2 py-0.5 font-semibold uppercase tracking-wider rounded ${KIND_TONE[suggestion.kind] || ""}`}>
            {suggestion.kind}
          </span>
          {suggestion.targetCompanyOrName && (
            <span className="text-xs text-muted-foreground">→ {suggestion.targetCompanyOrName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onReject}
            className={`px-2.5 py-1 text-xs font-medium border rounded-md ${
              rejected
                ? "bg-foreground/10 border-foreground/30 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {rejected ? "Rejected" : "Reject"}
          </button>
          <button
            onClick={onAccept}
            className={`px-2.5 py-1 text-xs font-medium border rounded-md ${
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
        <div className="text-xs text-muted-foreground mb-1">
          <span className="font-semibold mr-1">Replaces:</span>
          <span className="line-through">{suggestion.targetBullet}</span>
        </div>
      )}
      <p className="text-sm text-foreground leading-relaxed">{suggestion.suggested}</p>
      {suggestion.rationale && (
        <p className="text-xs text-muted-foreground mt-1.5 italic">{suggestion.rationale}</p>
      )}
      {suggestion.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestion.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">{t}</span>
          ))}
        </div>
      )}
    </li>
  );
}
