/**
 * Email scan review queue.
 *
 * Polls the latest backfill scan job; while it's running we show a calm
 * progress UI, and once it's `ready_for_review` we render the candidate
 * cards with per-row Import / Skip / Merge actions and a bulk "Import all"
 * affordance.
 *
 * Each candidate is independent — a single import failure doesn't block
 * the others, and we expose a Retry path on any candidate marked `failed`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "../../components/ui/toast.ts";
import { ArrowLeft, Check, ArrowRight } from "lucide-react";
import { emailAPI, type ScanCandidate, type ScanJob } from "../../utils/api.ts";
import { STAGE_TONE_CLASS } from "../../utils/stageStyles.ts";
import BrandTile from "../../components/BrandLogo/BrandLogo.tsx";
import PageHeader, { PageBody } from "../../components/ui/PageHeader.tsx";

const POLL_MS = 3500;

const STAGE_TONE = STAGE_TONE_CLASS;

const CONFIDENCE_LABEL: Record<ScanCandidate["confidence"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function EmailScanReview() {
  const navigate = useNavigate();
  const [job, setJob] = useState<ScanJob | null>(null);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState<"import" | "skip" | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { job: latest } = await emailAPI.getLatestScanJob();
      if (!latest) { setJob(null); setCandidates([]); setLoading(false); return; }
      setJob(latest);
      if (latest.status === "ready_for_review" || latest.status === "completed" || latest.status === "failed") {
        const { candidates: list } = await emailAPI.getScanCandidates(latest._id);
        setCandidates(list);
      }
    } catch {
      // surface via the existing axios toast; just keep last good state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Poll while the worker is still doing work.
  useEffect(() => {
    const inFlight = job && ["pending", "scanning", "filtering", "classifying"].includes(job.status);
    if (!inFlight) {
      if (pollRef.current) { window.clearTimeout(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = window.setTimeout(() => { void refresh(); }, POLL_MS);
    return () => {
      if (pollRef.current) { window.clearTimeout(pollRef.current); pollRef.current = null; }
    };
  }, [job, refresh]);

  const pending = useMemo(
    () => candidates.filter((c) => c.status === "pending" || c.status === "failed"),
    [candidates],
  );
  const decided = useMemo(
    () => candidates.filter((c) => c.status === "imported" || c.status === "skipped" || c.status === "merged"),
    [candidates],
  );

  const handleImport = async (c: ScanCandidate) => {
    try {
      await emailAPI.importCandidate(c._id);
      toast.success(`${c.company} imported.`);
      await refresh();
    } catch {/* axios toast already fired */}
  };
  const handleSkip = async (c: ScanCandidate) => {
    try {
      await emailAPI.skipCandidate(c._id);
      await refresh();
    } catch {/* */}
  };
  const handleMerge = async (c: ScanCandidate) => {
    if (!c.matchedApplicationId) return;
    try {
      await emailAPI.mergeCandidate(c._id, c.matchedApplicationId);
      toast.success(`Merged into existing ${c.company}.`);
      await refresh();
    } catch {/* */}
  };

  const handleBulkImport = async () => {
    if (!job) return;
    setBulkLoading("import");
    try {
      const r = await emailAPI.bulkImport(job._id);
      toast.success(`Imported ${r.imported}${r.failed ? ` · ${r.failed} failed` : ""}`);
      await refresh();
    } catch {/* */} finally { setBulkLoading(null); }
  };
  const handleSkipAll = async () => {
    if (!job) return;
    setBulkLoading("skip");
    try {
      const r = await emailAPI.skipAll(job._id);
      toast.success(`Skipped ${r.skipped} candidates.`);
      await refresh();
    } catch {/* */} finally { setBulkLoading(null); }
  };
  const handleFinish = async () => {
    if (!job) return;
    try {
      await emailAPI.completeScan(job._id);
      toast.success("Review closed.");
      navigate("/settings/connectors");
    } catch {/* */}
  };

  // Reached from Connectors (the scan banner, a notification): the way back is in the title.
  const header = (
    <PageHeader
      titleAs="div"
      title={
        <span className="inline-flex items-center gap-2 min-w-0">
          <Link
            to="/settings/connectors"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <ArrowLeft size={15} strokeWidth={2} aria-hidden />
            Connectors
          </Link>
          <span className="text-muted-foreground/50" aria-hidden>/</span>
          <h1 className="truncate">Review found applications</h1>
        </span>
      }
      meta={job ? (
        <>
          {job.windowDays}-day Gmail scan
          {job.status === "ready_for_review" && ` · ${job.counts.totalCandidates} candidate${job.counts.totalCandidates === 1 ? "" : "s"}`}
        </>
      ) : undefined}
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <PageBody size="lg" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </PageBody>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        {header}
        <EmptyState
          title="No inbox scan to review"
          body="Connect Gmail from Settings and we'll find recent applications for you."
          ctaLabel="Open Settings"
          ctaHref="/settings/connectors"
        />
      </div>
    );
  }

  return (
    <div>
      {header}
      <PageBody size="lg">

        {/* In-progress state */}
        {(["pending", "scanning", "filtering", "classifying"] as const).includes(job.status as never) && (
          <ProgressCard job={job} />
        )}

        {/* Failed */}
        {job.status === "failed" && (
          <div className="rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-5 mb-6">
            <div className="text-sm font-semibold text-red-900 dark:text-red-200">Scan failed</div>
            <p className="text-[13px] text-red-900/80 dark:text-red-200/80 mt-1">{job.error || "An unknown error occurred."}</p>
            <Link
              to="/settings/connectors"
              className="inline-block mt-3 px-4 py-2 text-sm font-medium border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg"
            >
              Retry from Settings
            </Link>
          </div>
        )}

        {/* Bulk actions */}
        {(job.status === "ready_for_review" || job.status === "completed") && pending.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-foreground">
              <span className="font-semibold">{pending.length}</span>{" "}
              <span className="text-muted-foreground">pending · {decided.length} decided</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!bulkLoading}
                onClick={handleSkipAll}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-50"
              >
                {bulkLoading === "skip" ? "Skipping…" : "Skip all"}
              </button>
              <button
                type="button"
                disabled={!!bulkLoading}
                onClick={handleBulkImport}
                className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
              >
                {bulkLoading === "import" ? "Importing…" : `Import all (${pending.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Empty — scan ran, found nothing */}
        {job.status === "ready_for_review" && candidates.length === 0 && (
          <EmptyState
            title="No applications detected"
            body="Your inbox didn't have any clear application emails in the chosen window. You can still add applications manually or via the extension."
            ctaLabel="Back to Settings"
            ctaHref="/settings/connectors"
          />
        )}

        {/* Candidates */}
        <div className="space-y-3">
          {pending.map((c) => (
            <CandidateCard
              key={c._id}
              c={c}
              onImport={() => handleImport(c)}
              onSkip={() => handleSkip(c)}
              onMerge={c.matchedApplicationId ? () => handleMerge(c) : undefined}
            />
          ))}
        </div>

        {/* Decided collapsed list */}
        {decided.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
              Show {decided.length} decided
            </summary>
            <div className="mt-3 space-y-2">
              {decided.map((c) => (
                <div
                  key={c._id}
                  className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
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

        {/* Finish */}
        {(job.status === "ready_for_review" || job.status === "completed") && pending.length === 0 && candidates.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-card p-5 text-center">
            <p className="text-sm text-foreground font-semibold">All caught up.</p>
            <p className="text-xs text-muted-foreground mt-1">You've reviewed every candidate from this scan.</p>
            <button
              type="button"
              onClick={handleFinish}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg"
            >
              Done
            </button>
          </div>
        )}
      </PageBody>
    </div>
  );
}

/* -------------------- progress card -------------------- */

function ProgressCard({ job }: { job: ScanJob }) {
  const phases = [
    { key: "scanning", label: "Reading your inbox", done: job.status !== "pending" && job.status !== "scanning" || (job.progress.fetched > 0 && job.status !== "scanning") },
    { key: "filtering", label: "Filtering candidates", done: job.status === "classifying" || job.status === "ready_for_review" },
    { key: "classifying", label: "Identifying applications", done: job.status === "ready_for_review" },
  ];
  const activeIdx = phases.findIndex((p) => !p.done);

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <h2 className="text-base font-semibold text-foreground">Scanning your inbox</h2>
      </div>
      <p className="text-xs text-muted-foreground">This runs in the background — you can leave this page and come back.</p>

      <ol className="mt-4 space-y-2.5">
        {phases.map((p, i) => {
          const active = i === activeIdx;
          return (
            <li key={p.key} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  p.done
                    ? "border-emerald-500 bg-emerald-500"
                    : active
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/30"
                }`}
              >
                {p.done ? (
                  <Check size={10} strokeWidth={3.5} className="text-white" />
                ) : active ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                ) : null}
              </div>
              <span className={`text-sm ${p.done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>

      {job.progress.fetched > 0 && (
        <div className="mt-4 pt-4 border-t border-border text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>{job.progress.fetched} emails scanned</span>
          {job.progress.candidates > 0 && <span>{job.progress.candidates} candidates</span>}
          {job.progress.threadGroups > 0 && <span>{job.progress.threadGroups} threads</span>}
          {job.progress.classified > 0 && <span>{job.progress.classified} classified</span>}
        </div>
      )}
    </div>
  );
}

/* -------------------- candidate card -------------------- */

function CandidateCard({ c, onImport, onSkip, onMerge }: {
  c: ScanCandidate;
  onImport: () => void;
  onSkip: () => void;
  onMerge?: () => void;
}) {
  const tone = STAGE_TONE[c.inferredStage];
  const isFailed = c.status === "failed";

  return (
    <div className={`rounded-xl border ${isFailed ? "border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/10" : "border-border bg-card"} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground truncate">{c.company || "Unknown company"}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider border ${tone.bg} ${tone.text} ${tone.border}`}>
              {c.inferredStage}
            </span>
            {c.matchedApplicationId && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                Already tracked
              </span>
            )}
            <span className="text-[10.5px] text-muted-foreground" title={CONFIDENCE_LABEL[c.confidence]}>
              {c.confidence === "high" ? "●●●" : c.confidence === "medium" ? "●●○" : "●○○"}
            </span>
          </div>
          {c.role && <p className="text-sm text-muted-foreground mt-0.5">{c.role}</p>}
        </div>
        <div className="text-[11px] text-muted-foreground shrink-0 text-right">
          {fmtDate(c.earliestEmailDate)}
          {c.earliestEmailDate !== c.latestEmailDate && (
            <> – {fmtDate(c.latestEmailDate)}</>
          )}
          {c.evidence.threadSize > 1 && (
            <div className="text-[10.5px] mt-0.5">{c.evidence.threadSize} emails</div>
          )}
        </div>
      </div>

      {/* Evidence */}
      <div className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 text-[12.5px]">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Latest email</div>
        <div className="text-foreground font-medium truncate" title={c.evidence.subject}>{c.evidence.subject || "(no subject)"}</div>
        <div className="text-muted-foreground truncate text-[11.5px] mt-0.5" title={c.evidence.from}>{c.evidence.from}</div>
        {c.evidence.snippet && (
          <p className="text-muted-foreground/90 mt-1.5 text-[12px] line-clamp-2 leading-relaxed">{c.evidence.snippet}</p>
        )}
      </div>

      {isFailed && c.importError && (
        <div className="mt-3 text-[12px] text-red-700 dark:text-red-300">
          <span className="font-semibold">Last attempt failed:</span> {c.importError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onImport}
          className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg inline-flex items-center gap-1.5"
        >
          {isFailed ? "Retry import" : "Import"}
          <ArrowRight size={11} strokeWidth={2.5} aria-hidden="true" />
        </button>
        {onMerge && (
          <button
            type="button"
            onClick={onMerge}
            className="px-3 py-1.5 text-xs font-medium border border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 rounded-lg"
            title="Update the existing application's stage and link this email to it"
          >
            Merge with existing
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

/* -------------------- empty state -------------------- */

function EmptyState({ title, body, ctaLabel, ctaHref }: { title: string; body: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-20 px-5">
      <BrandTile brand="gmail" size={48} className="mx-auto mb-4" />
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 mb-5">{body}</p>
      <Link
        to={ctaHref}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
