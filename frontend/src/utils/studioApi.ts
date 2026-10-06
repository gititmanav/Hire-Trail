/**
 * studioApi — the Resume Studio's endpoints (backend routes/resumes.ts).
 *
 * AI rewrites are PROPOSALS: `propose` returns suggested rewrites and changes
 * nothing; `acceptProposals` applies the ones the person keeps (the server
 * re-checks each against the current text, snapshots for undo, and returns
 * the document); `rejectProposals` drops the rest. No mock layer: a failed
 * call fails in place, it never fakes a result.
 */
import { api } from "./api.ts";
import {
  bulletPath, summaryTextPath,
  type ResumeDocument, type AIRewriteRequest, type GapAnalysis, type SectionFlag, type FitSummary, type AISuggestion,
  type ProposeResult, type AcceptResult,
} from "./resumeDocument.ts";

/** The gap response also carries the JD-aware deterministic score + suggestion
 *  chips so the Review gauge/chips refresh after Step 1 (they were computed at
 *  load time, before any JD existed), and the fit check's read. */
export type GapResult = GapAnalysis & { score?: number; suggestions?: AISuggestion[]; fit?: FitSummary | null };

/** The preview highlights by dotted path; proposals name bare element ids
 *  ("s2e1b1"). Translate by locating each id in the document. */
export function toDottedPaths(doc: ResumeDocument, ids: string[]): string[] {
  const want = new Set(ids);
  const out: string[] = [];
  for (const section of doc.sections ?? []) {
    for (const entry of section.entries ?? []) {
      // A summary is addressed by its ENTRY id (it has no bullets).
      if (section.type === "summary" && want.has(entry.id)) out.push(summaryTextPath(section.id, entry.id));
      for (const b of entry.bullets ?? []) {
        if (want.has(b.id)) out.push(bulletPath(section.id, entry.id, b.id));
      }
    }
  }
  return out;
}

export const resumeStudioAPI = {
  /** Step 1, "See the gap": the fit check names the role's requirements and
   *  the per-section read; coverage and score are computed against the
   *  document. Quiet — the step shows a failure in place, with its fix. */
  analyzeGap: async (resumeId: string, jobDescription: string): Promise<GapResult> => {
    const { data } = await api.post<{
      gap?: { matched: string[]; missing: string[]; coverageCount: number; total: number };
      sectionFlags?: SectionFlag[];
      score?: number;
      suggestions?: AISuggestion[];
      fit?: FitSummary | null;
    }>(`/resumes/${resumeId}/analyze-gap`, { jobDescription }, { quiet: true });
    const g = data.gap ?? { matched: [], missing: [], coverageCount: 0, total: 0 };
    return {
      coverage: g.total > 0 ? Math.round((g.coverageCount / g.total) * 100) : 0,
      matched: g.matched ?? [],
      missing: g.missing ?? [],
      sectionFlags: data.sectionFlags ?? [],
      score: data.score,
      suggestions: data.suggestions,
      fit: data.fit ?? null,
    };
  },

  /** The editable document (incl. score, suggestion chips, pending proposals). */
  getDocument: (resumeId: string): Promise<ResumeDocument> =>
    api.get<ResumeDocument>(`/resumes/${resumeId}/document`).then((r) => r.data),

  /** Debounced autosave target. */
  saveDocument: (resumeId: string, document: ResumeDocument): Promise<{ version: number }> =>
    api.put<{ version: number }>(`/resumes/${resumeId}/document`, document).then((r) => r.data),

  /** Ask for rewrites of the bullets in scope. Changes nothing. */
  propose: (resumeId: string, req: AIRewriteRequest): Promise<ProposeResult> =>
    api.post<ProposeResult>(`/resumes/${resumeId}/ai-rewrite`, req).then((r) => r.data),

  acceptProposals: (resumeId: string, ids: string[] | "all"): Promise<AcceptResult> =>
    api.post<AcceptResult>(`/resumes/${resumeId}/proposals/accept`, { ids }).then((r) => r.data),

  rejectProposals: (resumeId: string, ids: string[] | "all"): Promise<{ document: ResumeDocument }> =>
    api.post<{ document: ResumeDocument }>(`/resumes/${resumeId}/proposals/reject`, { ids }).then((r) => r.data),

  /** Bind the resume's document to an application's analysis (copies the
   *  session's requirement keywords onto the doc). Powers the drawer's skip-to-2. */
  bindSession: (resumeId: string, tailorSessionId: string): Promise<{ document: ResumeDocument; gap: { matched: string[]; missing: string[]; coverageCount: number; total: number }; sectionFlags: SectionFlag[]; fit: FitSummary | null }> =>
    api.post(`/resumes/${resumeId}/document/bind-session`, { tailorSessionId }).then((r) => r.data),

  /** Revert to a prior version. Returns the restored document. */
  revert: (resumeId: string, toVersion: number): Promise<ResumeDocument> =>
    api.post<ResumeDocument>(`/resumes/${resumeId}/revert`, { toVersion }).then((r) => r.data),

  /** Serialize the preview's HTML+CSS to a PDF (Gotenberg). */
  renderPdf: (payload: { html: string; css: string; filename?: string }): Promise<Blob> =>
    api.post(`/resumes/render-pdf`, payload, { responseType: "blob" }).then((r) => r.data as Blob),
};
