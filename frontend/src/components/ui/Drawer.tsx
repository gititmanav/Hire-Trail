/** The one side panel — ui/Modal's sibling for work that wants the height of
 *  the screen: an application's detail, a resume preview, the tailoring
 *  workspace, a profile section editor. Drawer + DrawerHeader decide the
 *  overlay, motion, focus and header once.
 *
 *  Behavior is Modal's (useOverlayLayer): portal, layer stack — Escape and
 *  outside clicks reach the top layer only, so a Select inside closes first —
 *  scroll lock, focus in and back out, Tab trapped, fields draw plain.
 *
 *  Motion: slides in from the right over a fading scrim — two layers, so the
 *  panel itself never goes see-through on the way. It closes itself —
 *  Escape, the scrim, DrawerHeader's X and anything calling useDrawerClose()
 *  slide the LIVE panel out and then call onClose, so an iframe or a rendered
 *  preview keeps its pixels while it leaves. A parent that unmounts it
 *  outright still gets the exit, on useExitAnimation's static copy. */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DRAWER_EXIT, useExitAnimation } from "../../hooks/useExitAnimation.ts";
import { DRAWER_EXIT_MS, prefersReducedMotion } from "../../utils/motion.ts";
import { FieldLookContext } from "./fieldLook.ts";
import { CloseButton } from "./Modal.tsx";
import { useOverlayLayer } from "./useOverlayLayer.ts";

interface DrawerContextValue { close: () => void; titleId: string }
const DrawerContext = createContext<DrawerContextValue | null>(null);

/** The drawer's animated close — for a Save that should also dismiss it. */
export function useDrawerClose(): () => void {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawerClose must be used inside <Drawer>");
  return ctx.close;
}

export function Drawer({
  onClose, width = 480, ariaLabel, className = "", children,
}: {
  onClose: () => void;
  /** Panel width — px, or any CSS length. Never wider than the screen. */
  width?: number | string;
  /** Accessible name; falls back to DrawerHeader's title. */
  ariaLabel?: string;
  /** Extra classes on the panel. */
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const exitRef = useExitAnimation(DRAWER_EXIT);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) { onCloseRef.current(); return; }
    setClosing(true);
    timer.current = window.setTimeout(() => onCloseRef.current(), DRAWER_EXIT_MS);
  }, []);

  const { overlayProps, panelProps } = useOverlayLayer("drawer", panelRef, close);
  const ctx = useMemo(() => ({ close, titleId }), [close, titleId]);

  return createPortal(
    <div
      // While closing itself the live panel plays the exit — dropping the ref
      // here (node still attached) means no copy plays it a second time.
      ref={closing ? undefined : exitRef}
      className={`fixed inset-0 z-50 flex justify-end ${closing ? "drawer-exit pointer-events-none" : ""}`}
    >
      <div data-drawer-scrim className={`absolute inset-0 bg-scrim/50 ${closing ? "" : "drawer-scrim-in"}`} {...overlayProps} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        tabIndex={-1}
        data-drawer-panel
        className={`relative h-full flex flex-col bg-card border-l border-border shadow-2xl outline-none ${closing ? "" : "drawer-panel-in"} ${className}`}
        style={{ width: typeof width === "number" ? `${width}px` : width, maxWidth: "calc(100vw - 12px)" }}
        {...panelProps}
      >
        <FieldLookContext.Provider value="plain">
          <DrawerContext.Provider value={ctx}>{children}</DrawerContext.Provider>
        </FieldLookContext.Provider>
      </div>
    </div>,
    document.body,
  );
}

/** Title row: an optional icon, the title (names the drawer), actions, the X. */
export function DrawerHeader({ title, icon, actions }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("DrawerHeader must be used inside <Drawer>");
  return (
    <div className="flex items-center justify-between gap-4 px-6 h-14 border-b border-border shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="shrink-0 flex">{icon}</span>}
        <h2 id={ctx.titleId} className="text-[15px] font-semibold text-foreground truncate">{title}</h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <CloseButton onClick={ctx.close} label="Close panel" />
      </div>
    </div>
  );
}

/** The scrolling region under the header. */
export function DrawerBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-5 ${className}`}>{children}</div>;
}
