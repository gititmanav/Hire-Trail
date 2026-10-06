/**
 * useStudioDocument — the ONE shared ResumeDocument state behind all three
 * Review tabs (AI Rewrite · Editor · Style). Any edit, in any tab, mutates this
 * document so the live preview reflects it immediately.
 *
 * Responsibilities:
 *   - load the document (+ keyword-gap) for a resume
 *   - debounced autosave with a status indicator (PUT /resumes/:id/document)
 *   - AI rewrites as proposals (POST .../ai-rewrite): nothing changes until the
 *     person accepts; accepting applies on the server (re-checked against the
 *     current text), highlights what moved, bumps the score before→after and
 *     appends to the "What's changed" log
 *   - undo / revert (restore the prior doc; best-effort POST .../revert)
 *   - the active AI target (section/entry chosen from the preview)
 *   - the non-destructive "fit to one page" density toggle
 *
 * It strictly reflects backend output — it never invents resume content.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "../../components/ui/toast.ts";
import { resumeStudioAPI, toDottedPaths } from "../../utils/studioApi.ts";
import { aiErrorCode, aiErrorFixableInSettings } from "../../utils/aiErrors.ts";
import {
  cloneDoc, normalizeOrders,
  type ResumeDocument, type AIChange, type AIProposal, type AIRewriteRequest, type GapAnalysis, type RewriteScope,
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

export interface GapError {
  message: string;
  /** The fix is in Settings → AI (no key, allowance used, feature off…). */
  fixInSettings: boolean;
}

/* ---------- per-tab session persistence (survives reloads/tab discards) ---------- */

interface StudioSessionState {
  jd?: string;
  gap?: GapAnalysis | null;
  /** Wizard position + align choices — written by StudioWizard. */
  step?: "gap" | "align" | "review";
  alignConfig?: { sectionIds: string[]; keywords: string[]; mode: "quick" | "full" } | null;
}

function studioSessionKey(resumeId: string): string {
  return `ht-studio:${resumeId}`;
}

export function readStudioSession(resumeId: string): StudioSessionState | null {
  if (!resumeId) return null;
  try {
    const raw = sessionStorage.getItem(studioSessionKey(resumeId));
    return raw ? (JSON.parse(raw) as StudioSessionState) : null;
  } catch {
    return null;
  }
}

export function writeStudioSession(resumeId: string, patch: StudioSessionState): void {
  if (!resumeId) return;
  try {
    const cur = readStudioSession(resumeId) ?? {};
    sessionStorage.setItem(studioSessionKey(resumeId), JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* storage full/blocked — persistence is best-effort */
  }
}

/** An analyze-gap failure for fail-in-place UX: the server's sentence, and
 *  whether its fix lives in Settings → AI (decided by the error code). */
function parseGapError(err: unknown): GapError {
  const e = err as { response?: { data?: { error?: unknown; details?: { lane?: string } } } };
  const dataErr = e?.response?.data?.error;
  const message = typeof dataErr === "string" && dataErr ? dataErr : "Couldn't check the job description. Please try again.";
  return { message, fixInSettings: aiErrorFixableInSettings(aiErrorCode(err), e?.response?.data?.details?.lane) };
}

export function useStudioDocument(resumeId: string, initialJd: string, initialGap: GapAnalysis | null = null) {
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [loading, setLoading] = useState(true);

  // `initialGap` lets the Applications drawer seed Step 1 from an already-
  // succeeded analysis (skip the LLM round-trip) — see ApplicationTailorDrawer.
  const [gap, setGap] = useState<GapAnalysis | null>(initialGap);
  // Starts false: the gap analysis is user-triggered (press "Analyze"), not an
  // auto-run. (The old auto-run fired on mount while resumeId was still "" — it
  // early-returned and left this stuck true, so "Analyzing the gap…" never ended.)
  const [gapLoading, setGapLoading] = useState(false);
  // Surfaces an AI failure in place (no key / quota / provider down) instead of
  // silently swallowing it — the empty/error state offers Retry + Add-a-key.
  const [gapError, setGapError] = useState<GapError | null>(null);
  const [jd, setJd] = useState(initialJd);

  // A browser tab discard (Chrome Memory Saver) or reload wipes React state and
  // silently threw users back to Step 1. Persist the session's progress (jd,
  // gap — and step/config in StudioWizard) per resume so a reload restores it.
  // resumeId resolves ASYNC on the /resume-studio page (primary-resume lookup),
  // so hydrate when it arrives — state initializers would only see "".
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!resumeId || hydratedFor.current === resumeId) return;
    hydratedFor.current = resumeId;
    const saved = readStudioSession(resumeId);
    if (!saved) return;
    if (!initialGap && saved.gap) setGap(saved.gap);
    if (!initialJd && saved.jd) setJd(saved.jd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);
  useEffect(() => {
    if (hydratedFor.current !== resumeId) return; // not hydrated yet
    if (!jd && !gap) return; // nothing meaningful — don't clobber a saved session
    writeStudioSession(resumeId, { jd, gap });
  }, [resumeId, jd, gap]);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [rewriting, setRewriting] = useState(false);
  const [proposals, setProposals] = useState<AIProposal[]>([]);
  const [settling, setSettling] = useState(false);
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
  // The latest document and whether an autosave is pending — accepting a
  // proposal flushes first, so the server applies it to what's on screen.
  const docRef = useRef<ResumeDocument | null>(null);
  docRef.current = doc;
  const savePending = useRef(false);

  /* ---------- initial load ---------- */
  useEffect(() => {
    if (!resumeId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    resumeStudioAPI.getDocument(resumeId)
      .then((d) => { if (!cancelled) { skipNextSave.current = true; setDoc(d); setProposals(d.proposals ?? []); } })
      .catch(() => { if (!cancelled) toast.error("Could not load the resume document."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resumeId]);

  const reanalyzeGap = useCallback((nextJd?: string) => {
    if (!resumeId) return;
    const useJd = nextJd ?? jd;
    setGapLoading(true);
    setGapError(null);
    resumeStudioAPI.analyzeGap(resumeId, useJd)
      .then((g) => {
        setGap({ coverage: g.coverage, matched: g.matched, missing: g.missing, sectionFlags: g.sectionFlags });
        setGapError(null);
        // Refresh the JD-aware deterministic score + suggestion chips so the
        // Review gauge/chips reflect the posting just analyzed (they were derived
        // at load time, before a JD existed). Display-only — don't trigger a save.
        if (g.score !== undefined || g.suggestions) {
          setDoc((prev) => {
            if (!prev) return prev;
            skipNextSave.current = true;
            return {
              ...prev,
              ...(g.score !== undefined ? { score: g.score } : {}),
              ...(g.suggestions ? { suggestions: g.suggestions } : {}),
            };
          });
        }
      })
      .catch((err) => setGapError(parseGapError(err)))
      .finally(() => setGapLoading(false));
  }, [resumeId, jd]);
  // No auto-run: the user presses "Analyze" in step 1. This avoids both the
  // perpetual-spinner bug and analyzing a placeholder JD the user didn't choose.

  /** Seed the gap from an already-succeeded analysis (the drawer's skip-Step-1)
   *  without an LLM round-trip. */
  const hydrateGap = useCallback((g: GapAnalysis) => {
    setGap(g);
    setGapError(null);
    setGapLoading(false);
  }, []);

  /* ---------- debounced autosave ---------- */
  useEffect(() => {
    if (!doc || !resumeId) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveState("saving");
    savePending.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      savePending.current = false;
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

  /** Save now if an edit is waiting on the debounce. */
  const flushSave = useCallback(async () => {
    if (!savePending.current || !docRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    savePending.current = false;
    await resumeStudioAPI.saveDocument(resumeId, docRef.current);
    setSaveState("saved");
    setLastSavedAt(new Date());
  }, [resumeId]);

  /** Take the server's document as the truth (it's already saved there). */
  const adopt = useCallback((next: ResumeDocument) => {
    skipNextSave.current = true;
    setDoc(next);
    setProposals(next.proposals ?? []);
  }, []);

  /* ---------- AI rewrite: propose, then accept ---------- */
  const runRewrite = useCallback(async (req: AIRewriteRequest) => {
    if (!doc) return;
    setRewriting(true);
    try {
      const result = await resumeStudioAPI.propose(resumeId, req);
      setProposals(result.document.proposals ?? result.proposals);
      const n = result.proposals.length;
      if (n) toast.success(`${n} suggested rewrite${n === 1 ? "" : "s"} — review ${n === 1 ? "it" : "them"} below`);
      else if (result.dropped) toast("No rewrite passed the checks — each one added a number that isn't in your resume.", { duration: 6000 });
      else toast("Nothing to change — this already reads well.");
    } catch {
      // The API layer's toast carries the reason (and the way to fix it).
    } finally {
      setRewriting(false);
    }
  }, [doc, resumeId]);

  const acceptProposals = useCallback(async (ids: string[] | "all") => {
    const current = docRef.current;
    if (!current) return;
    const accepted = proposals.filter((p) => ids === "all" || ids.includes(p.id));
    if (!accepted.length) return;
    setSettling(true);
    try {
      await flushSave();
      const snapshot: HistorySnapshot = { doc: cloneDoc(current), changes: [...changes] };
      const result = await resumeStudioAPI.acceptProposals(resumeId, ids);
      adopt(result.document);
      if (result.applied.length) {
        // Undo restores the server's snapshot from just before this accept —
        // its version is one below the document's now (autosave may have
        // moved the server past the version this tab loaded).
        snapshot.doc.version = Math.max(1, (result.document.version ?? 1) - 1);
        historyRef.current.push(snapshot);
        setCanUndo(true);
        const applied = accepted.filter((p) => result.applied.includes(p.id));
        setChanges((prev) => [
          ...applied.map((p) => ({
            path: p.path,
            summary: `${p.kind === "summary" ? "Rewrote the summary" : "Rewrote a bullet"}${p.reason ? ` — ${p.reason}` : ""}`,
            before: p.before,
            after: p.after,
          })),
          ...prev,
        ]);
        if (result.score) setScoreAnim(result.score);
        setChangedPaths(new Set(toDottedPaths(result.document, applied.map((p) => p.path))));
        if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
        highlightTimer.current = window.setTimeout(() => setChangedPaths(new Set()), 4500);
        const s = result.score;
        toast.success(
          s && s.after !== s.before
            ? `Applied ${result.applied.length} · match ${s.before.toFixed(1)} → ${s.after.toFixed(1)}`
            : `Applied ${result.applied.length} rewrite${result.applied.length === 1 ? "" : "s"}`,
        );
      }
      if (result.stale.length) {
        toast(`${result.stale.length} suggestion${result.stale.length === 1 ? " was" : "s were"} out of date — that text changed since — and skipped.`, { duration: 6000 });
      }
    } catch {
      // The API layer's toast carries the reason; nothing was applied.
    } finally {
      setSettling(false);
    }
  }, [proposals, changes, resumeId, flushSave, adopt]);

  const rejectProposals = useCallback(async (ids: string[] | "all") => {
    // Optimistic: they leave the list now; a failure brings them back.
    const prev = proposals;
    setProposals((ps) => (ids === "all" ? [] : ps.filter((p) => !ids.includes(p.id))));
    try {
      const { document } = await resumeStudioAPI.rejectProposals(resumeId, ids);
      setProposals(document.proposals ?? []);
    } catch {
      setProposals(prev);
    }
  }, [proposals, resumeId]);

  /* ---------- undo / revert ---------- */
  const undo = useCallback(async () => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    setCanUndo(historyRef.current.length > 0);
    setChanges(snap.changes);
    setChangedPaths(new Set());
    setScoreAnim(null);
    try {
      // The server keeps a snapshot from before every accept — restore it,
      // and take what it returns as the truth.
      adopt(await resumeStudioAPI.revert(resumeId, snap.doc.version ?? 1));
    } catch {
      skipNextSave.current = false;
      setDoc(snap.doc);
    }
    toast("Undid the last change");
  }, [resumeId, adopt]);

  /* ---------- target selection ---------- */
  const setTarget = useCallback((scope: RewriteScope, label: string) => {
    setTargetState(scope === "all" ? null : { scope, label });
  }, []);
  const clearTarget = useCallback(() => setTargetState(null), []);

  return {
    resumeId,
    doc, loading,
    gap, gapLoading, gapError, jd, setJd, reanalyzeGap, hydrateGap,
    saveState, lastSavedAt,
    applyEdit, patchStyle,
    rewriting, runRewrite,
    proposals, settling, acceptProposals, rejectProposals,
    changedPaths, changes,
    scoreAnim,
    canUndo, undo,
    target, setTarget, clearTarget,
    activeTargetKey: target ? targetKey(target.scope) : null,
    density, setDensity,
  };
}

export type StudioController = ReturnType<typeof useStudioDocument>;
