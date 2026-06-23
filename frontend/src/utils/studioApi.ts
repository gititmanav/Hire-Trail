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
  type AIStatus, type AIUsage, type ProviderInfo,
} from "./studioMocks.ts";
import type {
  ResumeDocument, AIRewriteRequest, AIRewriteResult, GapAnalysis,
} from "./resumeDocument.ts";

const envFlag = (import.meta.env.VITE_STUDIO_USE_MOCKS ?? "1") as string;
/** Master switch. Mocks ON by default while the backend is in flight. */
export const STUDIO_USE_MOCKS = envFlag !== "0" && envFlag !== "false";

const latency = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

let warnedOnce = false;
function notImplemented(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string };
  const s = e?.response?.status;
  return s === 404 || s === 501 || e?.code === "ERR_NETWORK" || s === undefined;
}
/** Try the real endpoint; fall back to the mock on "not implemented yet". */
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
  /** Gap analysis for Step 1 ("See the gap"). Tailor returns the keyword-gap. */
  analyzeGap: (resumeId: string, jobDescription: string): Promise<GapAnalysis> =>
    withFallback(
      "POST /tailor/gap",
      () => api.post<GapAnalysis>(`/tailor/gap`, { resumeId, jobDescription }).then((r) => r.data),
      () => mockGap(),
    ),

  /** Load the editable ResumeDocument (incl. score + suggestions). */
  getDocument: (resumeId: string): Promise<ResumeDocument> =>
    withFallback(
      "GET /resumes/:id/document",
      () => api.get<ResumeDocument>(`/resumes/${resumeId}/document`).then((r) => r.data),
      () => mockDocument(),
    ),

  /** Debounced autosave target. */
  saveDocument: (resumeId: string, document: ResumeDocument): Promise<{ version: number }> =>
    withFallback(
      "PUT /resumes/:id/document",
      () => api.put<{ version: number }>(`/resumes/${resumeId}/document`, document).then((r) => r.data),
      () => ({ version: (document.version ?? 1) }),
    ),

  /** The AI rewrite — scope + instruction/preset → {document, changes, changedPaths, score}. */
  aiRewrite: (resumeId: string, req: AIRewriteRequest, baseDoc: ResumeDocument): Promise<AIRewriteResult> =>
    withFallback(
      "POST /resumes/:id/ai-rewrite",
      () => api.post<AIRewriteResult>(`/resumes/${resumeId}/ai-rewrite`, req).then((r) => r.data),
      () => mockRewrite(baseDoc, req),
    ),

  /** Revert to a prior version. Returns the restored document. */
  revert: (resumeId: string, toVersion: number, priorDoc: ResumeDocument): Promise<ResumeDocument> =>
    withFallback(
      "POST /resumes/:id/revert",
      () => api.post<ResumeDocument>(`/resumes/${resumeId}/revert`, { toVersion }).then((r) => r.data),
      () => priorDoc,
    ),

  /** Serialize the preview's HTML+CSS to a PDF. Returns the response Blob — at
   *  integration it's application/pdf; the mock returns a print-ready text/html
   *  document so Download still produces a faithful, openable file. */
  renderPdf: (payload: { html: string; css: string; filename?: string }): Promise<Blob> =>
    withFallback(
      "POST /resumes/render-pdf",
      () => api.post(`/resumes/render-pdf`, payload, { responseType: "blob" }).then((r) => r.data as Blob),
      () => {
        const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${payload.filename || "resume"}</title><style>${payload.css}</style></head><body>${payload.html}</body></html>`;
        return new Blob([doc], { type: "text/html" });
      },
    ),
};

export type { AIStatus, AIUsage, ProviderInfo };
