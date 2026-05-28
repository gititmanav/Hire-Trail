/**
 * Frontend bug reporter — fires-and-forgets a POST to /api/bugs/report when
 * we catch something the user shouldn't have to see (5xx responses, uncaught
 * JS errors, unhandled promise rejections).
 *
 * Goals:
 *   1. Never crash the calling code (catch + drop).
 *   2. Never spam the server — 60-second per-fingerprint dedup so a render
 *      loop firing the same error 60×/sec doesn't fire 60×/sec to the API.
 *   3. Never block the user — uses navigator.sendBeacon when available so
 *      reports go out even during page unload.
 */
import { getApiBaseURL } from "../config/apiBase.ts";

type Source =
  | "frontend_uncaught"
  | "frontend_axios_5xx"
  | "frontend_unhandled_rejection";

interface ReportInput {
  source: Source;
  errorMessage: string;
  errorStack?: string;
  /** Override the route — defaults to `window.location.pathname`. */
  route?: string;
  /** Free-form context (will be sanitized server-side). */
  context?: unknown;
}

const DEDUP_WINDOW_MS = 60_000;
/** Map fingerprint → last-reported epoch ms. Bounded — see prune below. */
const recent = new Map<string, number>();

function fingerprint(input: ReportInput): string {
  const stackHead = (input.errorStack || "").split("\n").slice(0, 3).join("|");
  return `${input.source}::${input.errorMessage.slice(0, 200)}::${stackHead.slice(0, 200)}`;
}

function prune(now: number): void {
  // Cheap manual GC — keeps the map from leaking on a long-lived tab. We only
  // ever read this map on each report; pruning here costs nothing extra.
  if (recent.size < 200) return;
  for (const [k, ts] of recent) {
    if (ts < now - DEDUP_WINDOW_MS) recent.delete(k);
  }
}

export function reportClientBug(input: ReportInput): void {
  try {
    const now = Date.now();
    const fp = fingerprint(input);
    const last = recent.get(fp) ?? 0;
    if (now - last < DEDUP_WINDOW_MS) return;
    recent.set(fp, now);
    prune(now);

    const body = JSON.stringify({
      source: input.source,
      errorMessage: input.errorMessage.slice(0, 2000),
      errorStack: input.errorStack ? input.errorStack.slice(0, 8000) : undefined,
      route: input.route ?? window.location.pathname,
      context: input.context,
    });
    const url = `${getApiBaseURL()}/bugs/report`;

    // sendBeacon survives page-unload (perfect for window.onerror during a
    // crash). Falls back to a no-keepalive fetch when unavailable.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => { /* fire-and-forget */ });
  } catch {
    // Reporter must never throw.
  }
}

/** Install window-level handlers. Idempotent — multiple calls are no-ops. */
let installed = false;
export function installGlobalBugReporters(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    // Ignore noisy ResizeObserver loop warnings — they're not real bugs.
    if (event.message?.includes("ResizeObserver loop")) return;
    reportClientBug({
      source: "frontend_uncaught",
      errorMessage: event.message || "Uncaught error",
      errorStack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : (() => { try { return JSON.stringify(reason); } catch { return "Unhandled rejection"; } })();
    reportClientBug({
      source: "frontend_unhandled_rejection",
      errorMessage: message || "Unhandled rejection",
      errorStack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
