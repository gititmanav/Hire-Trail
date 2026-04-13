import { useEffect, useRef } from "react";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", h);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] animate-in" onClick={onCancel}>
      <div
        className="bg-card rounded-xl p-6 w-full max-w-[380px] shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-red-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
          </div>
        </div>

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
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-[transform,box-shadow,filter] ${
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
