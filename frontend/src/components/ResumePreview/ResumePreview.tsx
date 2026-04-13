import { useCallback, useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from "react";

interface Props {
  fileUrl: string;
  name: string;
  fileName: string;
  onClose: () => void;
}

const RESUME_SIDEBAR_WIDTH_KEY = "hiretrail-resume-sidebar-width";
const RESUME_SIDEBAR_MIN_WIDTH = 520;
const RESUME_SIDEBAR_MAX_WIDTH = 1100;

export default function ResumePreview({ fileUrl, name, fileName, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(900);
  const [resizing, setResizing] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(900);
  const suppressCloseRef = useRef(false);
  const clampWidth = useCallback((w: number) => {
    const viewportMax = Math.max(RESUME_SIDEBAR_MIN_WIDTH, window.innerWidth - 24);
    const maxAllowed = Math.min(RESUME_SIDEBAR_MAX_WIDTH, viewportMax);
    return Math.max(Math.min(w, maxAllowed), RESUME_SIDEBAR_MIN_WIDTH);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const saved = Number(localStorage.getItem(RESUME_SIDEBAR_WIDTH_KEY));
    const initial = Number.isFinite(saved) ? saved : 900;
    setSidebarWidth(clampWidth(initial));
  }, [clampWidth]);

  useEffect(() => {
    const onResize = () => setSidebarWidth((prev) => clampWidth(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampWidth]);

  useEffect(() => {
    localStorage.setItem(RESUME_SIDEBAR_WIDTH_KEY, String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

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
      // Ignore drag-end click to prevent accidental close.
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
      className="fixed inset-0 z-50 flex justify-end"
      onClick={() => {
        if (resizing || suppressCloseRef.current) return;
        handleClose();
      }}
    >
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative h-full bg-card shadow-2xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${sidebarWidth}px`, maxWidth: "calc(100vw - 12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize z-20 group ${resizing ? "bg-primary/30" : ""}`}
          onMouseDown={handleResizeStart}
          title={`Drag to resize (${RESUME_SIDEBAR_MIN_WIDTH}px–${RESUME_SIDEBAR_MAX_WIDTH}px)`}
        >
          <div className="h-full w-full transition-colors group-hover:bg-primary/20" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold text-foreground truncate mr-3">{name}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-1.5 !px-3 !text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mr-1.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open in new tab
            </a>
            <a href={fileUrl} download={fileName} className="btn-secondary !py-1.5 !px-3 !text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mr-1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </a>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
            </button>
          </div>
        </div>
        <iframe src={fileUrl} className="w-full h-full" title={name} />
      </div>
    </div>
  );
}
