/**
 * Unified Gmail-scan flow — single modal with backdrop that walks the user
 * through picker → scanning → review → done without page navigation.
 *
 * Why one modal: the review queue is a one-time temporary step. We have no
 * page to "come back to" later once the user has reviewed/imported, and an
 * abandoned mid-flow state was confusing in the previous design. Now the
 * user can't navigate away mid-flow without an explicit "lose results"
 * confirmation, which keeps the data model clean and the UX predictable.
 *
 * Internal state machine:
 *   picker    → choose 5/10/15-day window + consent
 *   scanning  → kicks off scan, polls job, shows progress steps
 *   review    → editable candidate cards with import/skip/merge
 *   done      → summary + Confirm to close
 *
 * Close attempts during `scanning` or `review` route through a red sub-
 * confirm. Confirming sends `abandonScan` so pending candidates are
 * cleaned up server-side (imported/merged ones stay — they're real Apps).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Mail, Filter, Search, AlertTriangle, RotateCw, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import { emailAPI, type ScanCandidate, type ScanJob, type ScanJobStatus } from "../../utils/api.ts";
import AiStepper from "../../components/AiIndicator/AiStepper.tsx";

const POLL_MS = 3000;

const WINDOWS = [
  { days: 5 as const,  label: "Last 5 days",  blurb: "Quickest. Surfaces only your most recent application emails." },
  { days: 10 as const, label: "Last 10 days", blurb: "Balanced. Good if you've been applying steadily this week or last.", recommended: true },
  { days: 15 as const, label: "Last 15 days", blurb: "Most thorough. Captures interview chains that started up to two weeks ago." },
];

const STAGES = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_TONE: Record<Stage, string> = {
  Drafting:  "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700",
  Applied:   "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  OA:        "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  Interview: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900",
  Offer:     "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  Rejected:  "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900",
};

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-shadow";

type Step = "picker" | "scanning" | "review" | "done" | "failed";

const NON_TERMINAL_JOB_STATUSES: ScanJobStatus[] = ["pending", "scanning", "filtering", "classifying"];

function stepForJob(job: ScanJob | null): Step {
  if (!job) return "picker";
  if (NON_TERMINAL_JOB_STATUSES.includes(job.status)) return "scanning";
  if (job.status === "ready_for_review") return "review";
  // A failed scan shows a dedicated error step — NOT the first-run day-picker.
  // Re-running here re-uses the existing consent/window, so a returning user
  // (or a manual "Scan now" that failed) is never forced back through setup.
  if (job.status === "failed") return "failed";
  return "done";
}

/** Heuristic: does this scan error mean the Gmail OAuth grant is dead (revoked,
 *  expired, password changed)? If so, retrying is futile — the user must
 *  reconnect Gmail to mint a fresh refresh token. */
function isReauthError(message: string | null | undefined): boolean {
  return /invalid_grant|reconnect|token|expired|unauthor|401|revoked/i.test(message || "");
}

export interface EmailScanFlowModalProps {
  /** Initial scan job pulled from the parent's status fetch — lets us land on
   *  the correct step (e.g. user reopens Settings mid-scan → starts at scanning). */
  initialJob: ScanJob | null;
  /** Fires when the modal closes for any reason. Caller refetches its own
   *  state (mailbox status, etc) so the Settings UI reflects the new world. */
  onClose: () => void;
  /** Fires when the user finishes the full flow successfully — caller can
   *  refresh applications/analytics to surface the freshly-imported rows. */
  onFinished?: () => void;
}

export default function EmailScanFlowModal({ initialJob, onClose, onFinished }: EmailScanFlowModalProps) {
  const [step, setStep] = useState<Step>(stepForJob(initialJob));
  const [job, setJob] = useState<ScanJob | null>(initialJob);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);

  const refreshJob = useCallback(async () => {
    try {
      const { job: latest } = await emailAPI.getLatestScanJob();
      setJob(latest);
      if (latest && (latest.status === "ready_for_review" || latest.status === "completed")) {
        const { candidates: list } = await emailAPI.getScanCandidates(latest._id);
        setCandidates(list);
      }
    } catch {/* axios toast covers it */}
  }, []);

  // Drive the step from job status as it evolves.
  useEffect(() => { setStep(stepForJob(job)); }, [job]);

  // Poll while the worker is mid-flight.
  useEffect(() => {
    if (!job || !NON_TERMINAL_JOB_STATUSES.includes(job.status)) return;
    const t = window.setTimeout(() => { void refreshJob(); }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [job, refreshJob]);

  // Lock the page scroll while the modal is open. Restores on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC / backdrop-click → either close directly (picker / done) or fall into
  // the "lose results" confirm (scanning / review).
  const requestClose = useCallback(() => {
    if (step === "scanning" || step === "review") {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [step, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [requestClose]);

  const handleStart = async (days: 5 | 10 | 15) => {
    try {
      const { scanJobId } = await emailAPI.startFirstScan(days);
      // Immediate optimistic job so the UI flips to "scanning" while we wait
      // for the first real poll to land. Filled in on the next refresh.
      setJob({
        _id: scanJobId,
        status: "pending",
        kind: "backfill",
        windowDays: days,
        progress: { fetched: 0, candidates: 0, threadGroups: 0, classified: 0 },
        counts: { totalCandidates: 0, imported: 0, skipped: 0, merged: 0, failed: 0 },
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });
      setStep("scanning");
      // Kick a refresh in case the worker is fast enough that we'd otherwise
      // wait POLL_MS before showing any progress.
      window.setTimeout(() => { void refreshJob(); }, 500);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Could not start the scan.");
    }
  };

  /** Re-run a failed scan without the picker. Re-uses the same kind/window:
   *  a manual scan re-runs as manual; a backfill re-runs the same day window.
   *  Consent was already recorded on the first attempt, so there's nothing to
   *  re-prompt. */
  const handleRetry = async () => {
    try {
      if (job?.kind === "manual") {
        const oneAm = new Date();
        oneAm.setHours(1, 0, 0, 0);
        let afterMs = oneAm.getTime();
        if (afterMs >= Date.now()) afterMs -= 24 * 60 * 60 * 1000;
        const { scanJobId } = await emailAPI.startManualScan(Math.floor(afterMs / 1000));
        setJob({
          _id: scanJobId, status: "pending", kind: "manual", windowDays: 1,
          progress: { fetched: 0, candidates: 0, threadGroups: 0, classified: 0 },
          counts: { totalCandidates: 0, imported: 0, skipped: 0, merged: 0, failed: 0 },
          error: null, startedAt: new Date().toISOString(), finishedAt: null,
        });
      } else {
        const days = ([5, 10, 15] as const).includes(job?.windowDays as 5 | 10 | 15)
          ? (job!.windowDays as 5 | 10 | 15)
          : 10;
        const { scanJobId } = await emailAPI.startFirstScan(days);
        setJob({
          _id: scanJobId, status: "pending", kind: "backfill", windowDays: days,
          progress: { fetched: 0, candidates: 0, threadGroups: 0, classified: 0 },
          counts: { totalCandidates: 0, imported: 0, skipped: 0, merged: 0, failed: 0 },
          error: null, startedAt: new Date().toISOString(), finishedAt: null,
        });
      }
      setStep("scanning");
      window.setTimeout(() => { void refreshJob(); }, 500);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Could not start the scan.");
    }
  };

  /** Reconnect Gmail (fresh OAuth) — the only fix for an expired/revoked grant. */
  const handleReconnect = async () => {
    try {
      const { url } = await emailAPI.connectGmail();
      window.location.href = url;
    } catch {
      toast.error("Couldn't start Gmail reconnect. Try the Connect button in Settings.");
    }
  };

  const handleAbandon = async () => {
    if (!job) { onClose(); return; }
    try { await emailAPI.abandonScan(job._id); } catch {/* swallow — UX still wants to close */}
    onClose();
  };

  const handleConfirmFinish = async () => {
    if (!job) { onClose(); onFinished?.(); return; }
    try { await emailAPI.completeScan(job._id); } catch {/* */}
    onClose();
    onFinished?.();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-flow-title"
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl animate-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "picker" && (
          <PickerStep onStart={handleStart} onClose={requestClose} />
        )}
        {step === "scanning" && job && (
          <ScanningStep job={job} onClose={requestClose} />
        )}
        {step === "review" && job && (
          <ReviewStep
            job={job}
            candidates={candidates}
            onRefresh={refreshJob}
            onClose={requestClose}
            onConfirmFinish={handleConfirmFinish}
          />
        )}
        {step === "done" && job && (
          <DoneStep job={job} onClose={() => { onClose(); onFinished?.(); }} />
        )}
        {step === "failed" && job && (
          <FailedStep job={job} onRetry={handleRetry} onReconnect={handleReconnect} onClose={onClose} />
        )}
      </div>

      {/* Lose-results sub-confirm */}
      {confirmClose && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); setConfirmClose(false); }}
        >
          <div
            className="bg-card border border-red-300 dark:border-red-900 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-red-700 dark:text-red-200">
              You&rsquo;ll lose the scan results.
            </h3>
            <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
              Closing now drops every candidate you haven&rsquo;t imported yet. Anything you already imported stays in your tracker. You can re-run the scan later, but it&rsquo;ll have to read your inbox again.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted"
              >
                Keep scanning
              </button>
              <button
                type="button"
                onClick={handleAbandon}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Close &amp; lose results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Failed step ───────────────────────── */

function FailedStep({ job, onRetry, onReconnect, onClose }: {
  job: ScanJob;
  onRetry: () => void;
  onReconnect: () => void;
  onClose: () => void;
}) {
  const reauth = isReauthError(job.error);
  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 id="scan-flow-title" className="text-lg font-semibold text-foreground">Scan didn&rsquo;t finish</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {reauth ? "Your Gmail connection needs to be refreshed." : "Something interrupted the scan."}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="px-6 py-7">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 px-4 py-3">
          <AlertTriangle size={18} strokeWidth={1.8} className="text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{job.error || "The scan failed."}</p>
            {reauth && (
              <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
                Google revoked or expired the access HireTrail had. Reconnect your Gmail to mint a fresh, read-only token — then run the scan again.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-muted"
        >
          Close
        </button>
        {reauth ? (
          <button
            type="button"
            onClick={onReconnect}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
          >
            <Link2 size={15} strokeWidth={2} />Reconnect Gmail
          </button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
          >
            <RotateCw size={15} strokeWidth={2} />Try again
          </button>
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Picker step ───────────────────────── */

function PickerStep({
  onStart,
  onClose,
}: {
  onStart: (days: 5 | 10 | 15) => Promise<void>;
  onClose: () => void;
}) {
  const [windowDays, setWindowDays] = useState<5 | 10 | 15>(10);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const start = async () => {
    if (!consent || submitting) return;
    setSubmitting(true);
    try { await onStart(windowDays); } finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
              One-time setup
            </div>
            <h2 id="scan-flow-title" className="text-lg font-semibold text-foreground">
              Scan your inbox for past applications
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We&rsquo;ll find recent application emails and let you review each one before anything lands in your tracker.
            </p>
          </div>
          <CloseButton onClick={onClose} disabled={submitting} />
        </div>
      </div>

      <div className="px-6 py-5 space-y-3 overflow-y-auto">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Pick a scan window
        </div>
        <div className="space-y-2">
          {WINDOWS.map((w) => {
            const active = windowDays === w.days;
            return (
              <button
                key={w.days}
                type="button"
                onClick={() => setWindowDays(w.days)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? "border-primary" : "border-muted-foreground/40"}`}>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{w.label}</span>
                  {w.recommended && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1 ml-6 leading-relaxed">{w.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What this scan does</div>
          <ul className="text-[12.5px] text-foreground/90 leading-relaxed space-y-1">
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>Reads subjects and bodies of recent emails, filtered to ones that look like job applications</li>
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>Shows you a review queue — you import what you want, skip the rest</li>
            <li className="flex gap-2"><span className="text-red-500 shrink-0 mt-0.5">✗</span>Never sends mail, replies, or modifies your inbox</li>
            <li className="flex gap-2"><span className="text-red-500 shrink-0 mt-0.5">✗</span>Doesn&rsquo;t train AI models on your data</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 w-4 h-4 accent-primary shrink-0"
          />
          <span className="text-[13px] text-foreground leading-relaxed">
            I&rsquo;m okay with HireTrail scanning the last {windowDays} days of my Gmail to detect job applications. I understand this is read-only.
          </span>
        </label>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-50"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={start}
          disabled={!consent || submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? "Starting…" : "Start scan"}
        </button>
      </div>
    </>
  );
}

/* ───────────────────────── Scanning step ───────────────────────── */

const SCAN_STEPS = [
  { key: "read", label: "Reading inbox", icon: Mail },
  { key: "filter", label: "Filtering candidates", icon: Filter },
  { key: "classify", label: "Identifying applications", icon: Search },
];

function ScanningStep({ job, onClose }: { job: ScanJob; onClose: () => void }) {
  const isManual = job.kind === "manual";
  const activeIndex = job.status === "classifying" ? 2 : job.status === "filtering" ? 1 : 0;

  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 id="scan-flow-title" className="text-lg font-semibold text-foreground">
            {isManual ? "Catching up on your inbox…" : "Scanning your inbox…"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isManual
              ? "Reading new mail since the start of today. Stay on this screen — closing now loses the results."
              : <>We&rsquo;re reading the last {job.windowDays} days. Stay on this screen — closing now loses the results.</>}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 py-7 space-y-5">
        <AiStepper steps={SCAN_STEPS} activeIndex={activeIndex} />

        {job.progress.fetched > 0 && (
          <div className="text-[11.5px] text-muted-foreground border-t border-border pt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <span>{job.progress.fetched} emails scanned</span>
            {job.progress.candidates > 0 && <span>{job.progress.candidates} candidates</span>}
            {job.progress.threadGroups > 0 && <span>{job.progress.threadGroups} threads</span>}
            {job.progress.classified > 0 && <span>{job.progress.classified} classified</span>}
          </div>
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Review step ───────────────────────── */

function ReviewStep({
  job, candidates, onRefresh, onClose, onConfirmFinish,
}: {
  job: ScanJob;
  candidates: ScanCandidate[];
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onConfirmFinish: () => Promise<void>;
}) {
  const pending = useMemo(() => candidates.filter((c) => c.status === "pending" || c.status === "failed"), [candidates]);
  const decided = useMemo(() => candidates.filter((c) => c.status === "imported" || c.status === "skipped" || c.status === "merged"), [candidates]);

  // Per-candidate edit drafts. Keyed by candidate id, only populated when the
  // user actually edits — otherwise we send the LLM-extracted values.
  type Draft = { company?: string; role?: string; stage?: Stage };
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const setDraft = (id: string, patch: Draft) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const [busyId, setBusyId] = useState<string | null>(null);

  const handleImport = async (c: ScanCandidate) => {
    const d = drafts[c._id] ?? {};
    const company = (d.company ?? c.company).trim();
    const role = (d.role ?? c.role).trim();
    if (!role) {
      toast.error("Role is required — type one in before importing.");
      return;
    }
    if (!company) {
      toast.error("Company is required.");
      return;
    }
    setBusyId(c._id);
    try {
      await emailAPI.importCandidate(c._id, {
        company,
        role,
        stage: d.stage ?? c.inferredStage,
      });
      await onRefresh();
    } catch {/* axios toast */} finally { setBusyId(null); }
  };
  const handleSkip = async (c: ScanCandidate) => {
    setBusyId(c._id);
    try { await emailAPI.skipCandidate(c._id); await onRefresh(); } catch {/* */} finally { setBusyId(null); }
  };
  const handleMerge = async (c: ScanCandidate) => {
    if (!c.matchedApplicationId) return;
    setBusyId(c._id);
    try { await emailAPI.mergeCandidate(c._id, c.matchedApplicationId); await onRefresh(); } catch {/* */} finally { setBusyId(null); }
  };

  const [confirming, setConfirming] = useState(false);
  const handleFinish = async () => {
    setConfirming(true);
    try { await onConfirmFinish(); } finally { setConfirming(false); }
  };

  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 id="scan-flow-title" className="text-lg font-semibold text-foreground">Review found applications</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {job.kind === "manual" ? "From today's inbox scan." : `From your last ${job.windowDays}-day Gmail scan.`}
            {" "}Found {candidates.length} candidate{candidates.length === 1 ? "" : "s"}.
            {" "}<span className="font-semibold">{pending.length}</span> pending · {decided.length} decided.
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
        {pending.length === 0 && decided.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No application emails detected in this window. You can close this and add applications manually or via the extension.
          </p>
        ) : null}

        {pending.map((c) => (
          <CandidateCard
            key={c._id}
            c={c}
            draft={drafts[c._id]}
            onChange={(patch) => setDraft(c._id, patch)}
            busy={busyId === c._id}
            onImport={() => handleImport(c)}
            onSkip={() => handleSkip(c)}
            onMerge={c.matchedApplicationId ? () => handleMerge(c) : undefined}
          />
        ))}

        {decided.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              Show {decided.length} decided
            </summary>
            <div className="mt-3 space-y-2">
              {decided.map((c) => (
                <div key={c._id} className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate">{c.company || "Unknown company"}</span>
                    {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-muted-foreground">
          {pending.length === 0
            ? "All caught up."
            : `${pending.length} candidate${pending.length === 1 ? "" : "s"} still pending.`}
        </p>
        <button
          type="button"
          onClick={handleFinish}
          disabled={confirming}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
        >
          {confirming ? "Finishing…" : pending.length === 0 ? "Confirm & finish" : "Done with review"}
        </button>
      </div>
    </>
  );
}

function CandidateCard({
  c, draft, onChange, busy, onImport, onSkip, onMerge,
}: {
  c: ScanCandidate;
  draft?: { company?: string; role?: string; stage?: Stage };
  onChange: (patch: { company?: string; role?: string; stage?: Stage }) => void;
  busy: boolean;
  onImport: () => void;
  onSkip: () => void;
  onMerge?: () => void;
}) {
  const company = draft?.company ?? c.company ?? "";
  const role = draft?.role ?? c.role ?? "";
  const stage: Stage = (draft?.stage ?? c.inferredStage) as Stage;
  const isFailed = c.status === "failed";

  return (
    <div className={`rounded-xl border ${isFailed ? "border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/10" : "border-border bg-card"} p-4 space-y-3`}>
      {/* Editable fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Company *</label>
          <input
            className={inputCls}
            value={company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="e.g. Stripe"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Role *</label>
          <input
            className={`${inputCls} ${!role.trim() ? "border-red-300 dark:border-red-700" : ""}`}
            value={role}
            onChange={(e) => onChange({ role: e.target.value })}
            placeholder="e.g. Backend Engineer"
            disabled={busy}
            aria-invalid={!role.trim() || undefined}
          />
          {!role.trim() && (
            <p className="text-[10.5px] text-red-600 dark:text-red-400 mt-1">
              We couldn&rsquo;t extract a role from this email. Type one in.
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Stage</label>
          <select
            className={inputCls}
            value={stage}
            onChange={(e) => onChange({ stage: e.target.value as Stage })}
            disabled={busy}
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-[11px] text-muted-foreground self-end pb-2">
          <span className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border text-[10px] ${STAGE_TONE[stage]}`}>
            {stage}
          </span>
          {c.matchedApplicationId && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Already tracked
            </span>
          )}
        </div>
      </div>

      {/* Evidence — latest email */}
      <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5 text-[12px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Latest email</div>
        <div className="text-foreground font-medium truncate" title={c.evidence.subject}>{c.evidence.subject || "(no subject)"}</div>
        <div className="text-muted-foreground truncate text-[11.5px] mt-0.5" title={c.evidence.from}>{c.evidence.from}</div>
        {c.evidence.snippet && (
          <p className="text-muted-foreground/90 mt-1 text-[11.5px] line-clamp-2 leading-relaxed">{c.evidence.snippet}</p>
        )}
      </div>

      {isFailed && c.importError && (
        <p className="text-[12px] text-red-700 dark:text-red-300">
          <span className="font-semibold">Last attempt failed:</span> {c.importError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onImport}
          disabled={busy || !role.trim() || !company.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
        >
          {busy ? "Working…" : isFailed ? "Retry import" : "Import"}
        </button>
        {onMerge && (
          <button
            type="button"
            onClick={onMerge}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium border border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 rounded-lg disabled:opacity-50"
            title="Update the existing application's stage with this email's signal"
          >
            Merge with existing
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Done step ───────────────────────── */

function DoneStep({ job, onClose }: { job: ScanJob; onClose: () => void }) {
  const { imported, skipped, merged } = job.counts;
  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 id="scan-flow-title" className="text-lg font-semibold text-foreground">Scan complete</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {job.kind === "manual" ? "From today's inbox scan." : `From your last ${job.windowDays}-day Gmail scan.`}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="px-6 py-8">
        <div className="grid grid-cols-3 gap-3">
          <SummaryStat label="Imported" value={imported} tone="emerald" />
          <SummaryStat label="Merged" value={merged} tone="amber" />
          <SummaryStat label="Skipped" value={skipped} tone="muted" />
        </div>
        {imported + merged + skipped === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-6">
            Nothing was imported. You can re-run a scan anytime from Settings.
          </p>
        )}
      </div>
      <div className="px-6 py-4 border-t border-border flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg"
        >
          Done
        </button>
      </div>
    </>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "muted" }) {
  const toneClass =
    tone === "emerald" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200" :
    tone === "amber"   ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200" :
                         "bg-muted text-muted-foreground";
  return (
    <div className={`rounded-xl p-4 text-center ${toneClass}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

/* ───────────────────────── Shared close button ───────────────────────── */

function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 shrink-0"
      aria-label="Close"
      type="button"
    >
      <X size={16} strokeWidth={2} />
    </button>
  );
}

// `inputCls` is re-exported for any consumer that needs to match the form
// styling outside this file (currently none — exported defensively).
export { inputCls };
