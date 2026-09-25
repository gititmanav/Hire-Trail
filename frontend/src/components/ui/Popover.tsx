/** The one floating surface. Every dropdown in the app — menus, selects, the
 *  date picker, comboboxes, hover cards, the notifications and Filters panels
 *  — renders through this, so look, motion, positioning, and dismissal are
 *  decided exactly once:
 *
 *  - Portals to <body> with fixed positioning (never clipped by an overflow
 *    container), measured against the viewport: opens below the trigger or
 *    flips above when there's more room there, and stays 8px inside the edges.
 *  - Fades/scales in from the trigger side; fades out on close (it stays
 *    mounted for the exit, then unmounts). prefers-reduced-motion skips both.
 *  - Registers on the shared layer stack (ui/layers.ts), so Escape and
 *    outside-click only ever close the top-most layer — a Select inside the
 *    Filters panel closes first, a dropdown inside a modal never closes the
 *    modal.
 *  - Closes on outside click, outside scroll, and resize (a fixed panel can't
 *    follow its trigger).
 *
 *  Controlled (`open` + `onOpenChange`); the caller renders the trigger and
 *  passes it as `anchorRef`, so any element can open a popover. Contents are
 *  the caller's — compose them from PopoverSection / PopoverLabel /
 *  PopoverDivider / itemClass so custom panels read like every menu. */
import { CSSProperties, ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isInsideLayerAbove, isTopLayer, popLayer, pushLayer } from "./layers.ts";
import { EXIT_MS, prefersReducedMotion } from "../../utils/motion.ts";

const EDGE = 8;

interface Placement { side: "bottom" | "top"; left: number; top?: number; bottom?: number; maxHeight: number }

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  /** Which trigger edge the panel lines up with. */
  align?: "start" | "end";
  /** CSS width; defaults to the content's natural width. */
  width?: number | string;
  /** Size the panel to the trigger (selects, comboboxes). */
  matchAnchorWidth?: boolean;
  /** Cap on the panel height; the viewport space is always a cap too. */
  maxHeight?: number;
  /** Panel padding / layout classes (the surface itself is fixed). */
  className?: string;
  style?: CSSProperties;
  offset?: number;
  ariaLabel?: string;
  role?: "dialog" | "menu" | "listbox" | "tooltip";
  id?: string;
  /** Element to focus on open; defaults to the panel itself. */
  initialFocusRef?: RefObject<HTMLElement>;
  /** false = leave focus where it is (comboboxes keep it in their input,
   *  hover cards never take it). */
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export default function Popover({
  open, onOpenChange, anchorRef, children, align = "start", width, matchAnchorWidth, maxHeight: maxHeightCap,
  className = "", style, offset = 6, ariaLabel, role = "dialog", id, initialFocusRef, autoFocus = true,
  onKeyDown, onPointerEnter, onPointerLeave,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  const [anchorWidth, setAnchorWidth] = useState<number | undefined>(undefined);

  // Presence: mount on open; on close keep the panel for its exit motion.
  useLayoutEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const unmount = () => { setMounted(false); setClosing(false); setPlace(null); };
    if (prefersReducedMotion()) { unmount(); return; }
    setClosing(true);
    const t = window.setTimeout(unmount, EXIT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Placement: measure the trigger and the rendered panel before paint.
  useLayoutEffect(() => {
    if (!open) return;
    if (!mounted) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    if (matchAnchorWidth) setAnchorWidth(r.width);
    const pw = matchAnchorWidth ? r.width : panel.offsetWidth;
    const ph = panel.scrollHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - offset - EDGE;
    const above = r.top - offset - EDGE;
    const side = ph <= below || below >= above ? "bottom" : "top";
    const room = side === "bottom" ? below : above;
    const rawLeft = align === "end" ? r.right - pw : r.left;
    const left = Math.max(EDGE, Math.min(rawLeft, vw - EDGE - pw));
    setPlace({
      side,
      left,
      top: side === "bottom" ? r.bottom + offset : undefined,
      bottom: side === "top" ? vh - r.top + offset : undefined,
      maxHeight: Math.max(120, maxHeightCap ? Math.min(room, maxHeightCap) : room),
    });
  }, [open, mounted, anchorRef, align, offset, matchAnchorWidth, maxHeightCap]);

  // Dismissal + layer + focus, only while open (a closing panel is inert).
  useEffect(() => {
    if (!open) return;
    const layer = pushLayer("popover", () => panelRef.current);
    const restore = document.activeElement as HTMLElement | null;
    if (autoFocus) requestAnimationFrame(() => (initialFocusRef?.current ?? panelRef.current)?.focus({ preventScroll: true }));

    // Capture phase: runs before any handler, so a trigger that stops
    // propagation (menu triggers inside clickable rows) can't hide the click.
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      // A click inside a layer opened on top of this one (a Select's list
      // inside the Filters panel) belongs to that layer.
      if (isInsideLayerAbove(layer, t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTopLayer(layer)) return;
      e.stopPropagation();
      onOpenChange(false);
      if (panelRef.current?.contains(document.activeElement) || autoFocus) anchorRef.current?.focus({ preventScroll: true });
    };
    const onScroll = (e: Event) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || isInsideLayerAbove(layer, t)) return;
      onOpenChange(false);
    };
    const onResize = () => onOpenChange(false);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      popLayer(layer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      // Return focus only if it was inside the panel (don't steal it from
      // wherever the user clicked next).
      if (panelRef.current?.contains(document.activeElement)) restore?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;
  const panelWidth = matchAnchorWidth ? anchorWidth : width;
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      tabIndex={-1}
      data-state={closing ? "closed" : "open"}
      data-side={place?.side ?? "bottom"}
      onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: "fixed",
        left: place?.left ?? 0,
        top: place ? place.top : 0,
        bottom: place?.bottom,
        width: panelWidth,
        maxHeight: place?.maxHeight,
        // First pass renders unplaced to measure; it's never painted there.
        visibility: place ? undefined : "hidden",
        transformOrigin: `${place?.side === "top" ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
        ...style,
      }}
      className={`float-panel z-[70] bg-popover text-popover-foreground border border-border rounded-xl shadow-floating overflow-auto outline-none ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─── Building blocks for panel contents ─── */

/** A padded group of rows. */
export function PopoverSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-1.5 ${className}`}>{children}</div>;
}

/** Quiet uppercase section label ("DISPLAY OPTIONS"), optional trailing action. */
export function PopoverLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/75">{children}</span>
      {action}
    </div>
  );
}

export function PopoverDivider() {
  return <div role="separator" className="h-px bg-border mx-1.5 my-1" />;
}

/** Row classes shared by every list-like dropdown (menu items, select
 *  options, combobox suggestions). `active` = hover / keyboard cursor. */
export function itemClass({ active, disabled, destructive, warning }: { active?: boolean; disabled?: boolean; destructive?: boolean; warning?: boolean } = {}): string {
  const tone = destructive ? "text-red-600 dark:text-red-400" : warning ? "text-orange-600 dark:text-orange-400" : "text-foreground";
  return `w-full flex items-center gap-2.5 min-h-9 px-2.5 py-1.5 rounded-lg text-[13.5px] text-left transition-colors duration-100 ${
    disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
  } ${active ? "bg-control" : ""} ${tone}`;
}
