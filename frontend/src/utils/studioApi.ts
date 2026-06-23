/**
 * studioApi — the mock-aware client the new AI Settings + Resume Studio screens
 * call. It delegates to the real typed endpoints in `api.ts`; until the backend
 * (built in parallel) answers them, it transparently falls back to `studioMocks`.
 *
 * To flip to the real backend at integration: set VITE_STUDIO_USE_MOCKS=0 (or
 * edit STUDIO_USE_MOCKS below). When mocks are off, a real endpoint that 404s /
 * 501s STILL falls back to a mock so a half-finished backend never hard-breaks
 * the UI — that auto-fallback is logged once to the console. See INTEGRATION.md.
 */
import { api, aiAPI } from "./api.ts";
import type { AIStatusResponse, AIUsageResponse } from "./api.ts";
import {
  mockStatus, mockUsage, mockDocument, mockGap, mockRewrite,
  type AIStatus, type AIUsage, type ProviderInfo, type UsageOp,
} from "./studioMocks.ts";
import {
  bulletPath, summaryTextPath,
  type ResumeDocument, type AIRewriteRequest, type AIRewriteResult, type GapAnalysis, type SectionFlag, type FitSummary, type AISuggestion,
} from "./resumeDocument.ts";

/** The gap response also carries the JD-aware deterministic score + suggestion
 *  chips so the Review gauge/chips refresh after Step 1 (they were computed at
 *  load time, before any JD existed). */
export type GapResult = GapAnalysis & { score?: number; suggestions?: AISuggestion[] };

/** The backend's ai-rewrite returns changedPaths as bare element ids (e.g. "s2e1b1");
 *  the preview highlights by dotted path. Translate ids → dotted bullet paths by
 *  locating each id in the returned document. Unmatched ids are dropped (the
 *  preview ignores paths it can't render, so this is safe). */
function toDottedChangedPaths(doc: ResumeDocument, ids: string[]): string[] {
  const want = new Set(ids);
  const out: string[] = [];
  for (const section of doc.sections ?? []) {
    for (const entry of section.entries ?? []) {
      // Summary rewrites change `extra.text`; the backend reports them by the
      // bare ENTRY id (summary has no bullets) → map to the summary path.
      if (section.type === "summary" && want.has(entry.id)) {
        out.push(summaryTextPath(section.id, entry.id));
      }
      for (const b of entry.bullets ?? []) {
        if (want.has(b.id)) out.push(bulletPath(section.id, entry.id, b.id));
      }
    }
  }
  // keep any ids that already look like dotted paths (forward-compatible)
  for (const id of ids) if (id.includes(".")) out.push(id);
  return out;
}

const envFlag = (import.meta.env.VITE_STUDIO_USE_MOCKS ?? "0") as string;
/** Master switch. Real endpoints by default now the backend is integrated; set
 *  VITE_STUDIO_USE_MOCKS=1 to force the mock layer (offline/dev). Even with this
 *  off, a missing endpoint still auto-falls-back so a partial backend never
 *  hard-breaks the UI. */
export const STUDIO_USE_MOCKS = envFlag === "1" || envFlag === "true";

const latency = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

let warnedOnce = false;
function notImplemented(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string };
  const s = e?.response?.status;
  return s === 404 || s === 501 || e?.code === "ERR_NETWORK" || s === undefined;
}
/** Try the real endpoint; fall back to the mock on "not implemented yet".
 *  Used ONLY for non-critical display data (AI status/usage). */
async function withFallback<T>(label: string, real: () => Promise<T>, mock: () => T | Promise<T>): Promise<T> {
  if (STUDIO_USE_MOCKS) { await latency(); return mock(); }
  try {
    return await real();
  } catch (err) {
    if (notImplemented(err)) {
      if (!warnedOnce) {
        warnedOnce = true;
        // eslint-disable-next-line no-console
        console.info(`[studioApi] "${label}" not available yet — using mock. Flip when the backend lands.`);
      }
      await latency();
      return mock();
    }
    throw err;
  }
}

/** CRITICAL studio paths (load/save/rewrite/analyze/render). These must NEVER
 *  silently fake success on a real failure — a user could otherwise edit/"save"
 *  a mock document and lose work. Mock data is served ONLY when the explicit
 *  VITE_STUDIO_USE_MOCKS flag is set; otherwise real errors propagate so the UI
 *  can fail in place (show a reason + Retry / Add-a-key). */
async function realOrMock<T>(real: () => Promise<T>, mock: () => T | Promise<T>): Promise<T> {
  if (STUDIO_USE_MOCKS) { await latency(); return mock(); }
  return real();
}

/* ---------- provider metadata (free-tier note + get-key link) ---------- */

/** Client-side provider catalogue. The backend's GET /api/ai/providers tells us
 *  which are byok-capable + the default models; the human-facing copy (labels,
 *  free-tier notes, get-key URLs, placeholders) lives here. */
export const PROVIDER_CATALOG: Record<ProviderInfo["provider"], {
  label: string; short: string; placeholder: string; getKeyUrl: string; freeTier: boolean; freeTierNote: string;
}> = {
  google: {
    label: "Google Gemini", short: "Gemini", placeholder: "AIza…",
    getKeyUrl: "https://aistudio.google.com/apikey",
    freeTier: true, freeTierNote: "Free tier — generous daily limits, no credit card. Recommended to start.",
  },
  openai: {
    label: "OpenAI (GPT)", short: "OpenAI", placeholder: "sk-proj-…",
    getKeyUrl: "https://platform.openai.com/api-keys",
    freeTier: false, freeTierNote: "Paid — usage-based pricing, requires billing set up.",
  },
  anthropic: {
    label: "Anthropic (Claude)", short: "Claude", placeholder: "sk-ant-…",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    freeTier: false, freeTierNote: "Paid — pay-as-you-go after free credits expire.",
  },
  openrouter: {
    label: "OpenRouter", short: "OpenRouter", placeholder: "sk-or-…",
    getKeyUrl: "https://openrouter.ai/keys",
    freeTier: true, freeTierNote: "Free tier on select models; one key, many providers.",
  },
};

export const aiInsightsAPI = {
  getStatus: (hasActiveKey: boolean): Promise<AIStatusResponse | AIStatus> =>
    withFallback<AIStatusResponse | AIStatus>("GET /ai/status", () => aiAPI.getStatus(), () => mockStatus(hasActiveKey)),
  getUsage: (hasActiveKey: boolean): Promise<AIUsageResponse | AIUsage> =>
    withFallback<AIUsageResponse | AIUsage>("GET /ai/usage", () => aiAPI.getUsage(), () => mockUsage(hasActiveKey)),
};

/* ---------- Resume Studio document + AI rewrite ---------- */

export const resumeStudioAPI = {
  /** Gap analysis for Step 1 ("See the gap"). The backend computes the keyword
   *  gap against the document's stored JD keywords and exposes it on the
   *  rewrite-suggestions endpoint; we map it to the studio's GapAnalysis shape.
   *  (jobDescription is accepted for API symmetry; the gap is derived from the
   *  document the resume was tailored against.) */
  analyzeGap: (resumeId: string, jobDescription: string): Promise<GapResult> =>
    realOrMock(
      async () => {
        // AI-driven Step 1: the backend runs the LLM brain to extract the role's
        // real requirements (noise stripped) + a per-section read, persists the
        // cleaned keyword set, and returns the DETERMINISTIC coverage against the
        // actual document (so the ring never lies) plus AI section flags. It also
        // returns the JD-aware score + chips so Review refreshes after Step 1.
        const { data } = await api.post<{
          gap?: { matched: string[]; missing: string[]; coverageCount: number; total: number };
          sectionFlags?: SectionFlag[];
          score?: number;
          suggestions?: AISuggestion[];
        }>(`/resumes/${resumeId}/analyze-gap`, { jobDescription });
        const g = data.gap ?? { matched: [], missing: [], coverageCount: 0, total: 0 };
        return {
          coverage: g.total > 0 ? Math.round((g.coverageCount / g.total) * 100) : 0,
          matched: g.matched ?? [],
          missing: g.missing ?? [],
          sectionFlags: data.sectionFlags ?? [],
          score: data.score,
          suggestions: data.suggestions,
        };
      },
      () => mockGap(),
    ),

  /** Load the editable ResumeDocument (incl. score + suggestions). */
  getDocument: (resumeId: string): Promise<ResumeDocument> =>
    realOrMock(
      () => api.get<ResumeDocument>(`/resumes/${resumeId}/document`).then((r) => r.data),
      () => mockDocument(),
    ),

  /** Debounced autosave target. */
  saveDocument: (resumeId: string, document: ResumeDocument): Promise<{ version: number }> =>
    realOrMock(
      () => api.put<{ version: number }>(`/resumes/${resumeId}/document`, document).then((r) => r.data),
      () => ({ version: (document.version ?? 1) }),
    ),

  /** The AI rewrite — scope + instruction/preset → {document, changes, changedPaths, score}. */
  aiRewrite: (resumeId: string, req: AIRewriteRequest, baseDoc: ResumeDocument): Promise<AIRewriteResult> =>
    realOrMock(
      async () => {
        const { data } = await api.post<AIRewriteResult>(`/resumes/${resumeId}/ai-rewrite`, req);
        // Backend reports changedPaths as bare element ids → translate to the
        // dotted paths the preview highlights against.
        return { ...data, changedPaths: toDottedChangedPaths(data.document, data.changedPaths ?? []) };
      },
      () => mockRewrite(baseDoc, req),
    ),

  /** Bind the resume's document to an application's analysis (copies the
   *  session's cleaned JD keywords onto the doc). Powers the drawer's skip-to-2. */
  bindSession: (resumeId: string, tailorSessionId: string): Promise<{ document: ResumeDocument; gap: { matched: string[]; missing: string[]; coverageCount: number; total: number }; sectionFlags: SectionFlag[]; fit: FitSummary | null }> =>
    api.post(`/resumes/${resumeId}/document/bind-session`, { tailorSessionId }).then((r) => r.data),

  /** Revert to a prior version. Returns the restored document. */
  revert: (resumeId: string, toVersion: number, priorDoc: ResumeDocument): Promise<ResumeDocument> =>
    realOrMock(
      () => api.post<ResumeDocument>(`/resumes/${resumeId}/revert`, { toVersion }).then((r) => r.data),
      () => priorDoc,
    ),

  /** Serialize the preview's HTML+CSS to a PDF. Returns the response Blob —
   *  application/pdf from Gotenberg. (Mock mode returns a print-ready text/html
   *  document so Download still produces a faithful, openable file.) */
  renderPdf: (payload: { html: string; css: string; filename?: string }): Promise<Blob> =>
    realOrMock(
      () => api.post(`/resumes/render-pdf`, payload, { responseType: "blob" }).then((r) => r.data as Blob),
      () => {
        const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${payload.filename || "resume"}</title><style>${payload.css}</style></head><body>${payload.html}</body></html>`;
        return new Blob([doc], { type: "text/html" });
      },
    ),
};

export type { AIStatus, AIUsage, ProviderInfo, UsageOp };
