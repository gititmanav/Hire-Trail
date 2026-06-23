/**
 * useStudioDocument — the ONE shared ResumeDocument state behind all three
 * Review tabs (AI Rewrite · Editor · Style). Any edit, in any tab, mutates this
 * document so the live preview reflects it immediately.
 *
 * Responsibilities:
 *   - load the document (+ keyword-gap) for a resume
 *   - debounced autosave with a status indicator (PUT /resumes/:id/document)
 *   - AI rewrite (POST .../ai-rewrite): swap doc, highlight changedPaths green,
 *     bump the score (before→after), append to the "What's Changed" log
 *   - undo / revert (restore the prior doc; best-effort POST .../revert)
 *   - the active AI target (section/entry chosen from the preview)
 *   - the non-destructive "fit to one page" density toggle
 *
 * It strictly reflects backend output — it never invents resume content.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resumeStudioAPI } from "../../utils/studioApi.ts";
import {
  cloneDoc, normalizeOrders,
  type ResumeDocument, type AIChange, type AIRewriteRequest, type GapAnalysis, type RewriteScope,
} from "../../utils/resumeDocument.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface StudioTarget {
  scope: RewriteScope;
  label: string;
}

interface HistorySnapshot {
  doc: ResumeDocument;
  changes: AIChange[];
}

function targetKey(scope: RewriteScope): string | null {
  if (scope === "all") return null;
  if (scope.entryId && scope.sectionId) return `${scope.sectionId}:${scope.entryId}`;
  if (scope.sectionId) return scope.sectionId;
  return null;
}

export function useStudioDocument(resumeId: string, initialJd: string) {
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const [gap, setGap] = useState<GapAnalysis | null>(null);
  const [gapLoading, setGapLoading] = useState(true);
  const [jd, setJd] = useState(initialJd);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [rewriting, setRewriting] = useState(false);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<AIChange[]>([]);
  const [scoreAnim, setScoreAnim] = useState<{ before: number; after: number } | null>(null);

  const [target, setTargetState] = useState<StudioTarget | null>(null);
  const [density, setDensity] = useState(1);

  const historyRef = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const skipNextSave = useRef(true);

  /* ---------- initial load ---------- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resumeStudioAPI.getDocument(resumeId)
      .then((d) => { if (!cancelled) { skipNextSave.current = true; setDoc(d); } })
      .catch(() => { if (!cancelled) toast.error("Could not load the resume document."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resumeId]);

  const reanalyzeGap = useCallback((nextJd?: string) => {
    const useJd = nextJd ?? jd;
    setGapLoading(true);
    resumeStudioAPI.analyzeGap(resumeId, useJd)
      .then((g) => setGap(g))
      .catch(() => { /* non-blocking */ })
      .finally(() => setGapLoading(false));
  }, [resumeId, jd]);

  useEffect(() => { reanalyzeGap(initialJd); /* once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- debounced autosave ---------- */
  useEffect(() => {
    if (!doc) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await resumeStudioAPI.saveDocument(resumeId, doc);
        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [doc, resumeId]);

  /* ---------- editing ---------- */
  /** Mutate the shared document. Clears any lingering AI highlight (a manual
   *  edit supersedes the last rewrite's highlight). */
  const applyEdit = useCallback((mutator: (draft: ResumeDocument) => void) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next = cloneDoc(prev);
      mutator(next);
      return normalizeOrders(next);
    });
    setChangedPaths((s) => (s.size ? new Set() : s));
  }, []);

  /** Replace the whole document (used by the Style tab's bulk style edits). */
  const patchStyle = useCallback((mutator: (draft: ResumeDocument["style"]) => void) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next = cloneDoc(prev);
      mutator(next.style);
      return next;
    });
  }, []);

  /* ---------- AI rewrite ---------- */
  const runRewrite = useCallback(async (req: AIRewriteRequest) => {
    if (!doc) return;
    setRewriting(true);
    const snapshot: HistorySnapshot = { doc: cloneDoc(doc), changes: [...changes] };
    try {
      const result = await resumeStudioAPI.aiRewrite(resumeId, req, doc);
      historyRef.current.push(snapshot);
      setCanUndo(true);
      skipNextSave.current = false; // persist the AI result via autosave
      setDoc(result.document);
      setChanges((prev) => [...result.changes, ...prev]);
      setScoreAnim(result.score);

      // transient green highlight
      const paths = new Set(result.changedPaths);
      setChangedPaths(paths);
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setChangedPaths(new Set()), 4500);

      const delta = result.score.after - result.score.before;
      toast.success(
        delta > 0 ? `Rewrote ${result.changedPaths.length || "the"} item${result.changedPaths.length === 1 ? "" : "s"} · match ${result.score.before.toFixed(1)}→${result.score.after.toFixed(1)}`
          : "Rewrite applied",
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e?.response?.data?.error || e?.message || "AI rewrite failed.");
    } finally {
      setRewriting(false);
    }
  }, [doc, changes, resumeId]);

  /* ---------- undo / revert ---------- */
  const undo = useCallback(async () => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    setCanUndo(historyRef.current.length > 0);
    skipNextSave.current = false;
    setDoc(snap.doc);
    setChanges(snap.changes);
    setChangedPaths(new Set());
    setScoreAnim(null);
    // Best-effort server revert; the local restore is authoritative for the UI.
    try { await resumeStudioAPI.revert(resumeId, snap.doc.version ?? 1, snap.doc); } catch { /* ignore */ }
    toast("Reverted the last AI change", { icon: "↩️" });
  }, [resumeId]);

  /* ---------- target selection ---------- */
  const setTarget = useCallback((scope: RewriteScope, label: string) => {
    setTargetState(scope === "all" ? null : { scope, label });
  }, []);
  const clearTarget = useCallback(() => setTargetState(null), []);

  return {
    resumeId,
    doc, loading,
    gap, gapLoading, jd, setJd, reanalyzeGap,
    saveState, lastSavedAt,
    applyEdit, patchStyle,
    rewriting, runRewrite,
    changedPaths, changes,
    scoreAnim,
    canUndo, undo,
    target, setTarget, clearTarget,
    activeTargetKey: target ? targetKey(target.scope) : null,
    density, setDensity,
  };
}

export type StudioController = ReturnType<typeof useStudioDocument>;
