/**
 * Tiny modal that shows the keyboard shortcuts available on the Applications
 * page. Opened by pressing "?" or clicking the toolbar help button.
 */
import { useEffect } from "react";
import { X } from "lucide-react";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["j", "k"], label: "Move row focus down / up" },
  { keys: ["Enter"], label: "Open application details" },
  { keys: ["e"], label: "Edit focused application" },
  { keys: ["x"], label: "Toggle selection on focused row" },
  { keys: ["/"], label: "Focus the search box" },
  { keys: ["Esc"], label: "Clear selection / close panel" },
  { keys: ["?"], label: "Show this help" },
];

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="bg-card border border-border rounded-xl p-5 w-full max-w-[380px] shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close shortcuts"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${s.label}-${i}`}
                    className="px-1.5 py-0.5 text-[11px] font-mono rounded-md border border-border bg-muted text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
