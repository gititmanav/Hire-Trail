/** A light panel that opens on hover (or keyboard focus, or a tap on touch
 *  screens) — "Where it works", "What this measures". The panel is a
 *  ui/Popover, so it looks and moves like every dropdown; moving the pointer
 *  from the trigger into the panel keeps it open. For a one-line label on an
 *  icon button, use Tooltip instead. */
import { ReactNode, useEffect, useRef, useState } from "react";
import Popover from "./Popover.tsx";

export default function HoverCard({
  children, content, align = "start", width = 240, openDelay = 200, closeDelay = 140, interactive = true, ariaLabel,
  className = "inline-flex", disabled = false, closeOnClick = false,
}: {
  /** The trigger. */
  children: ReactNode;
  content: ReactNode;
  align?: "start" | "end";
  width?: number;
  openDelay?: number;
  closeDelay?: number;
  /** false = the panel ignores the pointer (pure information). */
  interactive?: boolean;
  ariaLabel?: string;
  /** Classes for the trigger wrapper (defaults to an inline box). */
  className?: string;
  /** Closed and inert (e.g. while the trigger is being dragged). */
  disabled?: boolean;
  /** A click on the trigger closes the card (the trigger opens something else). */
  closeOnClick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const schedule = (next: boolean, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), ms);
  };
  const cancel = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (disabled) { window.clearTimeout(timer.current); setOpen(false); } }, [disabled]);

  return (
    <>
      <span
        ref={wrapRef}
        className={className}
        onPointerEnter={(e) => { if (e.pointerType === "mouse" && !disabled) schedule(true, openDelay); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") schedule(false, closeDelay); }}
        onClick={(e) => {
          if (closeOnClick) { cancel(); setOpen(false); return; }
          // Touch has no hover: a tap toggles.
          if (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches) {
            e.preventDefault();
            cancel();
            setOpen((o) => !o);
          }
        }}
        onFocusCapture={(e) => { if (!disabled && (e.target as HTMLElement).matches(":focus-visible")) schedule(true, 0); }}
        onBlurCapture={() => schedule(false, 0)}
      >
        {children}
      </span>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={wrapRef}
        align={align}
        width={width}
        role="tooltip"
        ariaLabel={ariaLabel}
        autoFocus={false}
        onPointerEnter={interactive ? cancel : undefined}
        onPointerLeave={interactive ? () => schedule(false, closeDelay) : undefined}
        style={interactive ? undefined : { pointerEvents: "none" }}
      >
        {content}
      </Popover>
    </>
  );
}
