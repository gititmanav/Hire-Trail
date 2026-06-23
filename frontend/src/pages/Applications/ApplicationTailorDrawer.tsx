/**
 * ApplicationTailorDrawer — the broad, Jobright-style tailoring drawer over an
 * application. It is the SAME engine as /resume-studio (StudioWizard over the
 * shared ResumeDocument), just in a drawer shell. Because the application's JD
 * was already screened by the one analysis brain (the fit score IS Step 1), the
 * drawer hydrates Step 1 from the succeeded TailorSession and OPENS AT STEP 2.
 *
 * Each application tailors its OWN per-app variant resume (POST
 * /applications/:id/tailor-resume) so tailoring one role never clobbers another
 * or the primary.
 *
 * State machine (no infinite spinners, never auto-advances to Step 3):
 *   loading → no-jd | analyzing(poll) | deferred | failed | ready
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, KeyRound, RotateCcw, Sparkles, X } from "lucide-react";
import AiPulse from "../../components/AiIndicator/AiPulse.tsx";
import StudioWizard from "../ResumeStudio/StudioWizard.tsx";
import { useStudioDocument } from "../ResumeStudio/useStudioDocument.ts";
import { applicationsAPI, tailorAPI, type TailorSession } from "../../utils/api.ts";
import { resumeStudioAPI } from "../../utils/studioApi.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import type { GapAnalysis } from "../../utils/resumeDocument.ts";

type Phase = "loading" | "no-jd" | "analyzing" | "deferred" | "failed" | "ready";
const POLL_MS = 2500;
const POLL_MAX = 38; // ~95s — mirrors the server's stale-processing reaper.

// The drawer is wide by default (the resume preview needs room) and drag-resizable
// within bounds; the chosen width is remembered.
const DRAWER_MIN_W = 600;
const DRAWER_MAX_W = 1700;
const DRAWER_STORAGE_KEY = "ht-tailor-drawer-w";
function defaultDrawerWidth(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  return Math.round(Math.min(DRAWER_MAX_W, Math.max(DRAWER_MIN_W, vw * 0.78)));
}

function isKeyIssue(msg: string): boolean {
  return /add (a )?key|no active key|api key|quota|credit|billing|exhausted/i.test(msg);
}
function errText(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || fallback;
}

export default function ApplicationTailorDrawer({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const { requireRealAccount } = useDemoGate();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jd, setJd] = useState("");
  const [initialGap, setInitialGap] = useState<GapAnalysis | null>(null);
  const pollRef = useRef<number | null>(null);

  // Drag-resizable width (default ~78vw), persisted across opens.
  const [width, setWidth] = useState<number>(() => {
    try { const s = Number(localStorage.getItem(DRAWER_STORAGE_KEY)); if (s >= DRAWER_MIN_W) return Math.min(s, DRAWER_MAX_W); } catch { /* ignore */ }
    return defaultDrawerWidth();
  });
  useEffect(() => { try { localStorage.setItem(DRAWER_STORAGE_KEY, String(width)); } catch { /* ignore */ } }, [width]);
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setWidth(Math.min(DRAWER_MAX_W, Math.max(DRAWER_MIN_W, window.innerWidth - ev.clientX)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  const finishClose = useCallback(() => { setOpen(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") finishClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [finishClose]);
  useEffect(() => () => { if (pollRef.current) window.clearTimeout(pollRef.current); }, []);

  /** Create/reuse this app's tailored variant, bind it to the session's JD
   *  keywords, hydrate the gap, and open Step 2. */
  const bindAndReady = useCallback(async (session: TailorSession) => {
    try {
      const { resumeId: rid } = await applicationsAPI.tailorResume(applicationId);
      setResumeId(rid);
      const res = await resumeStudioAPI.bindSession(rid, session._id);
      const g = res.gap;
      setInitialGap({
        coverage: g.total > 0 ? Math.round((g.coverageCount / g.total) * 100) : 0,
        matched: g.matched ?? [],
        missing: g.missing ?? [],
        sectionFlags: res.sectionFlags ?? [],
      });
      setPhase("ready");
    } catch (e) {
      setErrorMsg(errText(e, "Couldn't prepare the tailored resume."));
      setPhase("failed");
    }
  }, [applicationId]);

  const pollSession = useCallback((sessionId: string, attempt: number) => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = window.setTimeout(async () => {
      try {
        const s = await tailorAPI.get(sessionId);
        if (s.status === "succeeded") { await bindAndReady(s); return; }
        if (s.status === "failed") { setPhase("failed"); setErrorMsg(s.errorMessage || "Analysis failed."); return; }
        if (s.status === "deferred") { setPhase("deferred"); setErrorMsg(s.errorMessage || ""); return; }
        if (attempt >= POLL_MAX) { setPhase("failed"); setErrorMsg("Analysis is taking too long — please retry."); return; }
        pollSession(sessionId, attempt + 1);
      } catch {
        setPhase("failed"); setErrorMsg("Lost contact with the analysis — please retry.");
      }
    }, POLL_MS);
  }, [bindAndReady]);

  const startAnalysis = useCallback(async () => {
    if (!requireRealAccount("AI resume tailoring")) { finishClose(); return; }
    setPhase("analyzing");
    setErrorMsg("");
    try {
      const { sessionId } = await applicationsAPI.reanalyze(applicationId);
      pollSession(sessionId, 0);
    } catch (e) {
      setErrorMsg(errText(e, "Couldn't start the analysis."));
      setPhase("failed");
    }
  }, [requireRealAccount, finishClose, applicationId, pollSession]);

  const routeBySession = useCallback(async (session: TailorSession) => {
    if (session.status === "succeeded") { await bindAndReady(session); return; }
    if (session.status === "processing") { setPhase("analyzing"); pollSession(session._id, 0); return; }
    if (session.status === "deferred") { setPhase("deferred"); setErrorMsg(session.errorMessage || ""); return; }
    setPhase("failed"); setErrorMsg(session.errorMessage || "Analysis failed.");
  }, [bindAndReady, pollSession]);

  const init = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    try {
      const app = await applicationsAPI.getOne(applicationId);
      setJd(app.jobDescription || "");
      if (!app.tailorSessionId) {
        if ((app.jobDescription || "").trim().length < 50) { setPhase("no-jd"); return; }
        await startAnalysis(); // a JD exists but no analysis yet → kick one off
        return;
      }
      const session = await tailorAPI.get(app.tailorSessionId);
      await routeBySession(session);
    } catch (e) {
      setErrorMsg(errText(e, "Couldn't open the tailoring session."));
      setPhase("failed");
    }
  }, [applicationId, startAnalysis, routeBySession]);

  useEffect(() => { void init(); }, [init]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={finishClose}>
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative h-full max-w-[100vw] bg-background shadow-2xl flex flex-col border-l border-border transition-transform duration-200 motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tailor resume"
      >
        {/* Drag the left edge to resize. */}
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 z-20 h-full w-1.5 -ml-0.5 cursor-col-resize hover:bg-primary/30 transition-colors"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          title="Drag to resize"
        />
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-primary text-white">
              <Sparkles size={15} strokeWidth={2} />
            </span>
            <h2 className="text-base font-semibold text-foreground">Tailor resume to this role</h2>
          </div>
          <button onClick={finishClose} aria-label="Close" className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4">
          {phase === "loading" && (
            <div className="pt-24 flex justify-center"><AiPulse size={18} label="Opening…" labelSize={13} /></div>
          )}

          {phase === "analyzing" && (
            <div className="pt-24 flex flex-col items-center text-center gap-2">
              <AiPulse size={20} label="Analyzing this job against your profile…" labelSize={14} />
              <p className="text-xs text-muted-foreground max-w-xs">This is Step 1 — the same screening that powers the fit score. It opens at Align when ready.</p>
            </div>
          )}

          {phase === "no-jd" && (
            <div className="pt-20 flex flex-col items-center text-center">
              <h3 className="text-lg font-semibold text-foreground">No job description to analyze</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">Add a job description to this application, or tailor manually in Resume Studio.</p>
              <Link to="/resume-studio" className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">
                Open Resume Studio <ArrowRight size={15} strokeWidth={2} />
              </Link>
            </div>
          )}

          {phase === "deferred" && (
            <div className="pt-20 flex flex-col items-center text-center max-w-sm mx-auto">
              <h3 className="text-lg font-semibold text-foreground">Analysis not run yet</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{errorMsg || "This job hasn't been analyzed yet."}</p>
              <button onClick={() => void startAnalysis()} className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg">
                <Sparkles size={15} strokeWidth={2} /> Analyze now
              </button>
            </div>
          )}

          {phase === "failed" && (
            <div className="pt-20 flex flex-col items-center text-center max-w-sm mx-auto">
              <AlertTriangle size={22} className="text-red-500 mb-2" />
              <h3 className="text-base font-semibold text-foreground">Couldn't analyze this role</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{errorMsg}</p>
              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => void startAnalysis()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-border rounded-lg text-foreground hover:bg-muted">
                  <RotateCcw size={14} strokeWidth={2} /> Retry
                </button>
                {isKeyIssue(errorMsg) && (
                  <Link to="/settings/ai" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg">
                    <KeyRound size={14} strokeWidth={2} /> Add a key
                  </Link>
                )}
              </div>
            </div>
          )}

          {phase === "ready" && resumeId && (
            <DrawerStudioBody resumeId={resumeId} initialJd={jd} initialGap={initialGap} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Mounts the shared studio state once the variant resume + hydrated gap are
 *  resolved, and opens the wizard at Align (Step 1 already screened the JD). */
function DrawerStudioBody({ resumeId, initialJd, initialGap }: { resumeId: string; initialJd: string; initialGap: GapAnalysis | null }) {
  const studio = useStudioDocument(resumeId, initialJd, initialGap);
  if (studio.loading || !studio.doc) {
    return <div className="pt-24 flex justify-center"><AiPulse size={18} label="Loading your resume…" labelSize={13} /></div>;
  }
  return <StudioWizard studio={studio} initialStep="align" />;
}
