/** Anchored floating panel — the base for menus, the Filters panel, and any
 *  other click-to-open surface. Portals to <body> with fixed positioning (never
 *  clipped by an overflow container), flips above the trigger when there's no
 *  room below, closes on outside click / outside scroll / resize, and registers
 *  on the shared layer stack so Escape closes the top-most layer only.
 *
 *  Controlled (`open` + `onOpenChange`); the trigger is rendered by the caller
 *  and passed as `anchorRef`, so any element can open a popover. */
import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTopLayer, popLayer, pushLayer } from "./layers.ts";

type Align = "start" | "end";

interface Pos { top?: number; bottom?: number; left?: number; right?: number; maxHeight: number }

export default function Popover({
  open, onOpenChange, anchorRef, children, align = "start", width, className = "", offset = 6,
  ariaLabel, role = "dialog", initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  /** Which trigger edge the panel lines up with. */
  align?: Align;
  /** CSS width; defaults to the content's natural width. */
  width?: number | string;
  className?: string;
  offset?: number;
  ariaLabel?: string;
  role?: "dialog" | "menu" | "listbox";
  /** Element to focus on open; defaults to the panel itself. */
  initialFocusRef?: RefObject<HTMLElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<symbol | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - offset - 8;
    const above = r.top - offset - 8;
    const flip = below < 240 && above > below;
    const horizontal = align === "end"
      ? { right: Math.max(8, window.innerWidth - r.right) }
      : { left: Math.max(8, r.left) };
    setPos(flip
      ? { bottom: window.innerHeight - r.top + offset, maxHeight: above, ...horizontal }
      : { top: r.bottom + offset, maxHeight: below, ...horizontal });
  }, [open, anchorRef, align, offset]);

  useEffect(() => {
    if (!open) return;
    const layer = pushLayer("popover");
    layerRef.current = layer;
    const restore = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => (initialFocusRef?.current ?? panelRef.current)?.focus({ preventScroll: true }));

    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      // A click whose target was removed while handling it (e.g. picking an
      // option unmounts a nested Select's list) is not an outside click.
      if (!t.isConnected) return;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      // A nested layer (e.g. a Select inside the Filters panel) owns this click.
      if (!isTopLayer(layer)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTopLayer(layer)) return;
      e.stopPropagation();
      onOpenChange(false);
      anchorRef.current?.focus({ preventScroll: true });
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (!isTopLayer(layer)) return;
      onOpenChange(false);
    };
    const onResize = () => onOpenChange(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      popLayer(layer);
      layerRef.current = null;
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      // Return focus only if it was inside the panel (don't steal it from
      // wherever the user clicked next).
      if (panelRef.current?.contains(document.activeElement)) restore?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, width, maxHeight: pos.maxHeight }}
      className={`z-[70] bg-popover text-foreground border border-border rounded-xl shadow-lg overflow-auto outline-none animate-in ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
