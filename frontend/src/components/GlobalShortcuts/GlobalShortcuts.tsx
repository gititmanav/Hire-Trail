/**
 * App-wide keyboard shortcuts. Listens for the global `?`, `g <key>`, `n <key>`
 * sequences and routes to the appropriate page or surfaces the shortcuts modal.
 *
 * Why a dedicated component:
 *   - Keeps the binding logic + the help overlay in one place.
 *   - Stays out of the way of in-page shortcuts (Applications' j/k/etc) by
 *     respecting input focus and only activating top-level shortcuts.
 *
 * Sequence parsing: we accept `g a`, `g d`, etc. with up to a 1.2s window between
 * key presses (mirrors Linear / GitHub).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface Binding {
  /** Display label: e.g. "g a". */
  label: string;
  /** Description shown in the help modal. */
  description: string;
  /** Sequence — either a single key like "?" or two like "g a". */
  sequence: string[];
  /** What to do. */
  action: () => void;
  /** Section in the help modal. */
  section: "Navigation" | "Create" | "General";
}

const SEQUENCE_WINDOW_MS = 1200;

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export default function GlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const buffer = useRef<{ keys: string[]; expiresAt: number }>({ keys: [], expiresAt: 0 });

  const bindings = useMemo<Binding[]>(() => [
    // Navigation (g <letter>)
    { label: "g d", sequence: ["g", "d"], description: "Go to Dashboard",     section: "Navigation", action: () => navigate("/") },
    { label: "g a", sequence: ["g", "a"], description: "Go to Applications",  section: "Navigation", action: () => navigate("/applications") },
    { label: "g k", sequence: ["g", "k"], description: "Go to Kanban Board",  section: "Navigation", action: () => navigate("/kanban") },
    { label: "g c", sequence: ["g", "c"], description: "Go to Contacts",      section: "Navigation", action: () => navigate("/contacts") },
    { label: "g o", sequence: ["g", "o"], description: "Go to Companies",     section: "Navigation", action: () => navigate("/companies") },
    { label: "g r", sequence: ["g", "r"], description: "Go to Resumes",       section: "Navigation", action: () => navigate("/resumes") },
    { label: "g l", sequence: ["g", "l"], description: "Go to Deadlines",     section: "Navigation", action: () => navigate("/deadlines") },
    { label: "g m", sequence: ["g", "m"], description: "Go to Calendar",      section: "Navigation", action: () => navigate("/calendar") },
    { label: "g p", sequence: ["g", "p"], description: "Go to Profile",       section: "Navigation", action: () => navigate("/profile") },

    // Create (n <letter>) — opens the target page; the page itself focuses
    // the "Add" CTA so the user lands in the create modal.
    { label: "n a", sequence: ["n", "a"], description: "New application",    section: "Create", action: () => navigate("/applications?new=1") },
    { label: "n c", sequence: ["n", "c"], description: "New contact",        section: "Create", action: () => navigate("/contacts?new=1") },
    { label: "n d", sequence: ["n", "d"], description: "New deadline",       section: "Create", action: () => navigate("/deadlines?new=1") },

    // General
    { label: "?",   sequence: ["?"],     description: "Show this overlay",   section: "General", action: () => setHelpOpen(true) },
  ], [navigate]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping()) return;
    if (e.key === "Escape" && helpOpen) { setHelpOpen(false); return; }
    if (e.key === "?") {
      e.preventDefault();
      setHelpOpen((v) => !v);
      buffer.current = { keys: [], expiresAt: 0 };
      return;
    }

    const now = Date.now();
    if (now > buffer.current.expiresAt) buffer.current = { keys: [], expiresAt: 0 };

    const key = e.key.toLowerCase();
    // Single-letter prefix that starts a sequence — don't consume the event
    // so per-page shortcuts (j/k/e/etc.) still work.
    if (buffer.current.keys.length === 0 && (key === "g" || key === "n")) {
      buffer.current = { keys: [key], expiresAt: now + SEQUENCE_WINDOW_MS };
      return;
    }
    if (buffer.current.keys.length === 1) {
      const full = [...buffer.current.keys, key];
      const match = bindings.find((b) => b.sequence.length === 2 && b.sequence[0] === full[0] && b.sequence[1] === full[1]);
      buffer.current = { keys: [], expiresAt: 0 };
      if (match) {
        e.preventDefault();
        match.action();
      }
    }
  }, [bindings, helpOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* When focus moves into an input, immediately drop any pending sequence
   * prefix. Prevents the case where the user pressed `g`, then Tab focuses
   * an input, then they type a character — we don't want that character
   * misinterpreted as part of a navigation sequence. */
  useEffect(() => {
    const onFocusIn = () => {
      if (isTyping()) buffer.current = { keys: [], expiresAt: 0 };
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // Close help when route changes (in case a binding fires it).
  useEffect(() => { setHelpOpen(false); }, [location.pathname]);

  if (!helpOpen) return null;

  const grouped: Record<string, Binding[]> = {};
  for (const b of bindings) {
    (grouped[b.section] = grouped[b.section] || []).push(b);
  }

  return (
    <div
      className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setHelpOpen(false); }}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-[520px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground tracking-tight">Keyboard shortcuts</h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
            type="button"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {Object.entries(grouped).map(([section, items]) => (
            <section key={section}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section}</h3>
              <ul className="space-y-1.5">
                {items.map((b) => (
                  <li key={b.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{b.description}</span>
                    <span className="flex items-center gap-1">
                      {b.sequence.map((k, i) => (
                        <kbd
                          key={`${b.label}-${i}`}
                          className="px-1.5 py-0.5 text-[11px] font-mono rounded-md border border-border bg-muted text-foreground min-w-[20px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Shortcuts pause while you're typing in inputs.
        </div>
      </div>
    </div>
  );
}
