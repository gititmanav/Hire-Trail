/**
 * Overlay-mode chrome for `ApplicationDetailBody`. Provides:
 *   - Slide-in animation + backdrop
 *   - Resizable width via the drag handle on the left edge
 *   - ESC-to-close + click-outside-to-close
 *
 * The actual content (header, form, field sections) lives in
 * `ApplicationDetailBody` so the persistent right-column on the Applications
 * page can render the same content inline at xl+ widths without dragging in
 * the overlay-specific behaviors.
 */
import { useCallback, useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from "react";
import ApplicationDetailBody, { type SidebarEditForm } from "./components/ApplicationDetailBody.tsx";
import type { Application, Contact, Deadline, Resume, Stage } from "../../types";

const SIDEBAR_WIDTH_KEY = "hiretrail-app-sidebar-width";
const SIDEBAR_MIN_WIDTH = 460;
const SIDEBAR_MAX_WIDTH = 920;

interface Props {
  app: Application;
  resumes: Resume[];
  contacts: Contact[];
  deadlines: Deadline[];
  onClose: () => void;
  onStageChange: (id: string, stage: Stage) => void;
  onViewResume: (resume: Resume) => void;
  onSaveInline: (id: string, data: SidebarEditForm) => Promise<void>;
}

export default function ApplicationDetailSidebar({
  app, resumes, contacts, deadlines, onClose, onStageChange, onViewResume, onSaveInline,
}: Props) {
  const [sidebarWidth, setSidebarWidth] = useState(560);
  const [resizing, setResizing] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(560);
  const suppressCloseRef = useRef(false);

  const clampWidth = useCallback((w: number) => {
    const viewportMax = Math.max(SIDEBAR_MIN_WIDTH, window.innerWidth - 24);
    const maxAllowed = Math.min(SIDEBAR_MAX_WIDTH, viewportMax);
    return Math.max(Math.min(w, maxAllowed), SIDEBAR_MIN_WIDTH);
  }, []);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    const initial = Number.isFinite(saved) && saved > 0 ? saved : 560;
    setSidebarWidth(clampWidth(initial));
  }, [clampWidth]);
  useEffect(() => {
    const onResize = () => setSidebarWidth((prev) => clampWidth(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampWidth]);
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(sidebarWidth))); }, [sidebarWidth]);

  const [open, setOpen] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  const finishClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") finishClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [finishClose]);

  const handleResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = dragStartXRef.current - e.clientX;
      setSidebarWidth(clampWidth(dragStartWidthRef.current + delta));
    };
    const onUp = () => {
      setResizing(false);
      setTimeout(() => { suppressCloseRef.current = false; }, 0);
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, clampWidth]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      onClick={() => { if (resizing || suppressCloseRef.current) return; finishClose(); }}
    >
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative h-full bg-card shadow-2xl flex flex-col border-l border-border transition-transform duration-300 motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${sidebarWidth}px`, maxWidth: "calc(100vw - 12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize z-20 group ${resizing ? "bg-primary/30" : ""}`}
          onMouseDown={handleResizeStart}
          title={`Drag to resize (${SIDEBAR_MIN_WIDTH}px–${SIDEBAR_MAX_WIDTH}px)`}
        >
          <div className="h-full w-full group-hover:bg-primary/20" />
        </div>

        <ApplicationDetailBody
          app={app}
          resumes={resumes}
          contacts={contacts}
          deadlines={deadlines}
          onStageChange={onStageChange}
          onViewResume={onViewResume}
          onSaveInline={onSaveInline}
          onClose={finishClose}
        />
      </div>
    </div>
  );
}
