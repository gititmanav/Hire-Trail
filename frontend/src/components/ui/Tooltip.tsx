/** Quiet hover/focus label for icon-only controls. Appears after a short delay
 *  (instantly while another tooltip was just showing, like macOS), portals to
 *  <body>, and never intercepts the pointer. Keyboard focus shows it too, but
 *  only for :focus-visible (a mouse click doesn't flash a tooltip).
 *
 *  Wraps its children in an inline-flex span rather than cloning them, so it
 *  composes with triggers that own their ref (Menu, Popover anchors). */
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

let lastHiddenAt = 0;
const DELAY_MS = 450;
const WARM_WINDOW_MS = 400;

export default function Tooltip({ label, shortcut, children, side = "bottom" }: {
  label: ReactNode;
  shortcut?: string;
  children: ReactNode;
  side?: "bottom" | "top";
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const showing = useRef(false);

  const place = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    showing.current = true;
    setPos({ x: r.left + r.width / 2, y: side === "bottom" ? r.bottom + 6 : r.top - 6 });
  };
  const show = () => {
    window.clearTimeout(timer.current);
    if (Date.now() - lastHiddenAt < WARM_WINDOW_MS) place();
    else timer.current = window.setTimeout(place, DELAY_MS);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    if (showing.current) lastHiddenAt = Date.now();
    showing.current = false;
    setPos(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocusCapture={(e) => { if ((e.target as HTMLElement).matches(":focus-visible")) show(); }}
      onBlurCapture={hide}
    >
      {children}
      {pos && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", left: pos.x, top: pos.y, transform: `translate(-50%, ${side === "bottom" ? "0" : "-100%"})` }}
          className="z-[80] pointer-events-none px-2 py-1 rounded-md bg-foreground text-background text-[11.5px] font-medium whitespace-nowrap shadow-md flex items-center gap-1.5"
        >
          {label}
          {shortcut && <kbd className="px-1 rounded bg-background/15 text-[10.5px] font-sans">{shortcut}</kbd>}
        </div>,
        document.body,
      )}
    </span>
  );
}
