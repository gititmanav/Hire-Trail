import { useEffect, useRef, useState } from "react";
import { XCircle } from "lucide-react";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, the user must type this exact string to enable the confirm
   *  button (type-to-confirm). Used for irreversible deletes. */
  requireType?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  requireType,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");

  const gated = !!requireType;
  const canConfirm = !gated || typed === requireType;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", h);
    // Focus the type-to-confirm input when gated, otherwise the confirm button.
    if (gated) inputRef.current?.focus();
    else confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", h);
  }, [onCancel, gated]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] animate-in" onClick={onCancel}>
      <div
        className="bg-card rounded-xl p-6 w-full max-w-[380px] shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <XCircle size={20} strokeWidth={1.5} className="text-red-500" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
          </div>
        </div>

        {gated && (
          <div className="mb-1">
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">{requireType}</span> to confirm
            </label>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireType}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) onConfirm(); }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="btn-secondary !text-sm"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-[transform,box-shadow,filter] disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "btn-accent"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
