/** Modal a user can pop from any page to report a bug, suggest a feature, or share an idea.
 *  Portaled to document.body so it escapes the sidebar's overflow-hidden clipping context. */
import { useEffect, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { feedbackAPI } from "../../utils/api.ts";
import type { FeedbackType } from "../../utils/api.ts";

interface Props {
  onClose: () => void;
  /** Pre-fill the form. Useful when triggered from a specific CTA (e.g. "Request Gmail access"). */
  initial?: { type?: FeedbackType; title?: string; message?: string };
}

interface TypeOption { value: FeedbackType; label: string; description: string; icon: React.ReactNode }

const TYPES: TypeOption[] = [
  {
    value: "bug",
    label: "Bug",
    description: "Something broke or behaved wrong.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="14" rx="4" />
        <path d="M19 7l-3 2M5 7l3 2M19 13l-3-1M5 13l3-1M12 20v2M9 22h6" />
      </svg>
    ),
  },
  {
    value: "suggestion",
    label: "Suggestion",
    description: "A change to something that exists.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </svg>
    ),
  },
  {
    value: "idea",
    label: "Idea",
    description: "Something new we could build.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c1 .8 1.5 1.7 1.5 2.8h5c0-1.1.5-2 1.5-2.8A7 7 0 0012 2z" />
      </svg>
    ),
  },
  {
    value: "praise",
    label: "Praise",
    description: "Tell us what's working.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 00-6 0v4H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2v-9a2 2 0 00-2-2h-6z" />
      </svg>
    ),
  },
  {
    value: "other",
    label: "Other",
    description: "Anything else.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
];

export default function FeedbackModal({ onClose, initial }: Props) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>(initial?.type ?? "bug");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  const handleClose = () => { setOpen(false); setTimeout(onClose, 200); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (title.trim().length < 3) { toast.error("Add a short title."); return; }
    if (message.trim().length < 8) { toast.error("Add a little more detail."); return; }
    setSubmitting(true);
    try {
      await feedbackAPI.submit({
        type,
        title: title.trim(),
        message: message.trim(),
        pageContext: `${location.pathname}${location.search}`,
        userAgent: navigator.userAgent,
        appVersion: "4.0",
      });
      toast.success("Thanks — we got it.");
      handleClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: unknown } } };
      const msg = typeof e.response?.data?.error === "string" ? e.response.data.error : "Could not send feedback. Try again?";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/65 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full max-w-[560px] bg-card border border-border rounded-2xl shadow-2xl transition-all duration-200 ${open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98]"}`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send feedback</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Bugs, ideas, what's broken, what's missing — anything.</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Close">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-5 space-y-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Type</span>
            <div className="grid grid-cols-5 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  title={t.description}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    type === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="One-line summary"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</label>
              <span className="text-[10px] text-muted-foreground">{message.length}/8000</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={8000}
              rows={6}
              placeholder={
                type === "bug"
                  ? "Steps to reproduce, what you expected, what happened…"
                  : "Tell us more — the more context the better."
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring resize-y min-h-[120px]"
              required
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We attach your current page (<code className="font-mono text-foreground">{location.pathname}</code>) and browser to help reproduce issues. Your name and email are included so we can follow up.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:brightness-110 rounded-lg disabled:opacity-50">
              {submitting ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
