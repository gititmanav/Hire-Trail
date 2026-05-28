/**
 * One-time consent + window picker shown after a user connects Gmail for
 * the first time (or any time they're connected but haven't completed the
 * backfill scan yet).
 *
 * Picks a 5 / 10 / 15-day window for the initial inbox scan, captures
 * explicit consent, and triggers the async backfill worker.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { emailAPI } from "../../utils/api.ts";

const WINDOWS = [
  {
    days: 5 as const,
    label: "Last 5 days",
    blurb: "Quickest. Surfaces only your most recent application emails.",
  },
  {
    days: 10 as const,
    label: "Last 10 days",
    blurb: "Balanced. Good if you've been applying steadily this week or last.",
    recommended: true,
  },
  {
    days: 15 as const,
    label: "Last 15 days",
    blurb: "Most thorough. Captures interview chains that started up to two weeks ago.",
  },
];

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-shadow";

export function EmailScanConsentModal({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  /** Called after the server accepts the scan request. Receives the new job id
   *  and the window the user picked — the parent uses these to register a
   *  background task so progress persists across page navigation. */
  onStarted: (info: { scanJobId: string; windowDays: 5 | 10 | 15 }) => void;
}) {
  const navigate = useNavigate();
  const [windowDays, setWindowDays] = useState<5 | 10 | 15>(10);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, submitting]);

  const start = async () => {
    if (!consent || submitting) return;
    setSubmitting(true);
    try {
      const result = await emailAPI.startFirstScan(windowDays);
      toast.success("Inbox scan started — we'll show progress in the bottom-right.");
      onStarted({ scanJobId: result.scanJobId, windowDays });
      onClose();
      navigate("/settings/email-review");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Could not start the scan.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-consent-title"
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
                One-time setup
              </div>
              <h2 id="scan-consent-title" className="text-lg font-semibold text-foreground">
                Scan your inbox for past applications
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We&rsquo;ll find applications you sent recently and create cards for them — you decide what to import before anything lands in your tracker.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 shrink-0"
              aria-label="Close"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Window picker */}
        <div className="px-6 py-5 space-y-3">
          <div>
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
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          active ? "border-primary" : "border-muted-foreground/40"
                        }`}
                      >
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
          </div>

          {/* What we do / don't do */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              What this scan does
            </div>
            <ul className="text-[12.5px] text-foreground/90 leading-relaxed space-y-1">
              <li className="flex gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>
                Reads subjects and bodies of recent emails, filtered to ones that look like job applications
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>
                Shows you a review queue — you import what you want, skip the rest
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                Never sends mail, replies, or modifies your inbox
              </li>
              <li className="flex gap-2">
                <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                Doesn&rsquo;t train AI models on your data
              </li>
            </ul>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 w-4 h-4 accent-primary shrink-0"
            />
            <span className="text-[13px] text-foreground leading-relaxed">
              I&rsquo;m okay with HireTrail scanning the last {windowDays} days of my Gmail to detect job applications. I understand this is read-only and the scan runs once.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
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
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? "Starting…" : "Start scan"}
            {!submitting && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailScanConsentModal;

// `inputCls` is exported only to keep the linter happy when the file is reused
// by the modal. Re-export the constant in case any consumer needs the same
// field styling for inline edits.
export { inputCls };
