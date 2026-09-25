/** The one modal shell. Every dialog in the app composes Modal + ModalHeader +
 *  ModalBody + ModalFooter so overlay, motion, focus, and spacing are decided
 *  exactly once.
 *
 *  Behavior: portal to <body>, scroll lock while any modal is open, focus moves
 *  into the panel on mount and returns on close, Tab is trapped, Escape closes
 *  only the top-most modal (nested modals stack), and outside-click only counts
 *  when the press STARTED on the overlay — dragging a text selection out of an
 *  input never dismisses the dialog.
 *
 *  Motion: the overlay fades and the panel scales in; on close — however the
 *  dialog is closed — it fades/scales out (useExitAnimation), so every dialog
 *  animates both ways without its call site doing anything. */
import { useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { pushLayer, popLayer, isTopLayer, layerCount } from "./layers.ts";
import { MODAL_EXIT, MODAL_SOFT_EXIT, useExitAnimation } from "../../hooks/useExitAnimation.ts";

const SIZES = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[680px]",
  xl: "max-w-[800px]",
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  onClose, size = "md", children, ariaLabel, className = "", overlayClassName = "", motion = "default",
}: {
  onClose: () => void;
  size?: keyof typeof SIZES;
  children: ReactNode;
  /** Accessible name; falls back to the panel's first heading. */
  ariaLabel?: string;
  /** Extra classes on the panel — e.g. a theme scope (`theme-dark dark`). */
  className?: string;
  /** Extra classes on the overlay — e.g. a backdrop blur. */
  overlayClassName?: string;
  /** "soft": a slower, gentler arrival and departure (the sign-in sheet). */
  motion?: "default" | "soft";
}) {
  const idRef = useRef<symbol | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const soft = motion === "soft";
  const exitRef = useExitAnimation(soft ? MODAL_SOFT_EXIT : MODAL_EXIT);
  const restoreRef = useRef<HTMLElement | null>(null);
  const pressStartedOnOverlay = useRef(false);

  const isTop = () => idRef.current !== null && isTopLayer(idRef.current);

  useEffect(() => {
    const id = pushLayer("modal", () => panelRef.current);
    idRef.current = id;
    restoreRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    // Move focus into the panel: honor [data-autofocus], else first focusable.
    const panel = panelRef.current;
    if (panel) {
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel).focus({ preventScroll: true });
    }

    return () => {
      popLayer(id);
      idRef.current = null;
      if (layerCount() === 0) document.body.style.overflow = "";
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        // Wrap focus at the panel edges.
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
          .filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      ref={exitRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/50 ${soft ? "modal-soft-overlay-in" : "modal-overlay-in"} ${overlayClassName}`}
      onMouseDown={(e) => { pressStartedOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (pressStartedOnOverlay.current && e.target === e.currentTarget && isTop()) onClose();
        pressStartedOnOverlay.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`w-full ${SIZES[size]} max-h-[88vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl ${soft ? "modal-soft-panel-in" : "animate-in"} outline-none ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  title, description, onClose, icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground leading-6">{title}</h2>
          {description && <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="w-8 h-8 -mr-1.5 -mt-0.5 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Scrollable middle region. Owns horizontal padding so long forms scroll
 *  under the header/footer without clipping focus rings. */
export function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 pb-1 overflow-y-auto min-h-0 ${className}`}>{children}</div>;
}

export function ModalFooter({ children, start }: { children: ReactNode; start?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 mt-4 border-t border-border shrink-0">
      <div className="min-w-0">{start}</div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}
