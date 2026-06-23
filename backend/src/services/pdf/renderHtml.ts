/**
 * Pluggable HTML → PDF renderer (task 7).
 *
 * The only engine today is Gotenberg (Chromium route) running on Cloud Run with
 * scale-to-zero. Everything Gotenberg-specific lives behind `renderHtmlToPdf`,
 * so swapping engines later (or running Gotenberg locally) touches only this
 * file. Callers pass a single, already-sanitized, fully self-contained HTML
 * document (see services/resume/html.ts → composeHtml/documentToHtml).
 *
 * Cold start: Cloud Run min-instances=0 means the first request after idle can
 * take ~20–30s to boot. We allow a generous timeout and do ONE warm-up retry
 * (ping /health, then re-send) before surfacing a friendly "warming up" error.
 *
 * SSRF: the HTML is sanitized of external references AND Gotenberg must be run
 * with network denied (see backend/DEPLOY_GOTENBERG.md). Defense in depth.
 */
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";

export interface RenderHtmlInput {
  /** A complete, sanitized HTML document (doctype/html/head/body). */
  html: string;
  filename?: string;
}

export interface RenderHtmlResult {
  pdf: Buffer;
  filename: string;
}

const COLD_START_TIMEOUT_MS = 30_000;
const WARMUP_TIMEOUT_MS = 35_000;

export function isHtmlRendererConfigured(): boolean {
  return Boolean(env.GOTENBERG_URL);
}

function gotenbergUrl(path: string): string {
  return `${env.GOTENBERG_URL.replace(/\/$/, "")}${path}`;
}

/** Build the multipart form Gotenberg's Chromium HTML route expects. */
function buildForm(html: string): FormData {
  const form = new FormData();
  // The HTML entrypoint MUST be named index.html.
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");
  // Per-request options. ATS-safe text + backgrounds; single-page width, content
  // flows to multiple pages naturally (no force-fit).
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
  // Don't wait on network — our HTML is fully inlined and Gotenberg is network-denied.
  form.append("emulatedMediaType", "print");
  return form;
}

async function postOnce(html: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(gotenbergUrl("/forms/chromium/convert/html"), {
      method: "POST",
      body: buildForm(html),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const err = new Error(`Gotenberg returned ${res.status}: ${detail}`) as Error & { statusCode: number };
      err.statusCode = res.status;
      throw err;
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function pingHealth(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);
  try {
    await fetch(gotenbergUrl("/health"), { signal: controller.signal });
  } catch {
    /* best-effort warm-up */
  } finally {
    clearTimeout(timer);
  }
}

export async function renderHtmlToPdf(input: RenderHtmlInput): Promise<RenderHtmlResult> {
  if (!isHtmlRendererConfigured()) {
    throw new AppError("PDF rendering isn't configured on the server (GOTENBERG_URL unset).", 503);
  }
  const filename = sanitizeFilename(input.filename) || "resume.pdf";

  try {
    const pdf = await postOnce(input.html, COLD_START_TIMEOUT_MS);
    return { pdf, filename };
  } catch (firstErr) {
    // Cold start / transient: ping health to wake the instance, then retry ONCE.
    await pingHealth();
    try {
      const pdf = await postOnce(input.html, WARMUP_TIMEOUT_MS);
      return { pdf, filename };
    } catch (secondErr) {
      const e = secondErr as { name?: string; statusCode?: number; message?: string };
      if (e?.name === "AbortError") {
        throw new AppError("The PDF service is warming up — please try again in a few seconds.", 503);
      }
      console.error("[renderHtmlToPdf] failed:", firstErr, secondErr);
      throw new AppError(
        e?.statusCode && e.statusCode >= 400 && e.statusCode < 500
          ? "Couldn't render the PDF — the document markup was rejected."
          : "The PDF service is unavailable right now — please try again shortly.",
        503,
      );
    }
  }
}

function sanitizeFilename(name?: string): string {
  if (!name) return "";
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}
