/** What every blocking overlay does — ui/Modal and ui/Drawer share it, so
 *  focus, Escape and scroll behave the same in both:
 *
 *  - joins the layer stack (layers.ts), so Escape and outside clicks reach
 *    only the top-most layer — an open Select closes before its dialog does;
 *  - locks page scroll while any layer is open;
 *  - moves focus in on mount — to `[data-autofocus]`, else the panel itself
 *    (never the header's close button: a ring on it reads as a stray state)
 *    — and back to where it was on close;
 *  - traps Tab inside the panel;
 *  - hands Escape to `onDismiss`.
 *
 *  `overlayProps` dismisses on a click that both started and ended on the
 *  overlay, so dragging a text selection out of a field never closes it. */
import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { isTopLayer, layerCount, popLayer, pushLayer } from "./layers.ts";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useOverlayLayer(label: string, panelRef: RefObject<HTMLElement>, onDismiss: () => void) {
  const idRef = useRef<symbol | null>(null);
  const pressStartedOnOverlay = useRef(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  const isTop = () => idRef.current !== null && isTopLayer(idRef.current);

  useEffect(() => {
    const id = pushLayer(label, () => panelRef.current);
    idRef.current = id;
    const restore = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    if (panel) (panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel).focus({ preventScroll: true });

    return () => {
      popLayer(id);
      idRef.current = null;
      if (layerCount() === 0) document.body.style.overflow = "";
      restore?.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss.current();
        return;
      }
      if (e.key === "Tab") {
        // Wrap focus at the panel edges (the panel itself counts as before the first).
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
          .filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) { e.preventDefault(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayProps = {
    onMouseDown: (e: MouseEvent) => { pressStartedOnOverlay.current = e.target === e.currentTarget; },
    onMouseUp: (e: MouseEvent) => {
      if (pressStartedOnOverlay.current && e.target === e.currentTarget && isTop()) dismiss.current();
      pressStartedOnOverlay.current = false;
    },
  };
  /** On the panel: presses inside it never count as outside. */
  const panelProps = {
    onMouseDown: (e: MouseEvent) => e.stopPropagation(),
    onMouseUp: (e: MouseEvent) => e.stopPropagation(),
  };

  return { overlayProps, panelProps };
}
