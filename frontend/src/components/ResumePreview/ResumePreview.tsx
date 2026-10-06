/** A resume file in a side panel (ui/Drawer) — drag its left edge to resize;
 *  the width is remembered. */
import { useCallback, useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Drawer, DrawerHeader } from "../ui/Drawer.tsx";
import { buttonClass } from "../ui/Button.tsx";

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
  const [sidebarWidth, setSidebarWidth] = useState(900);
  const [resizing, setResizing] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(900);
  const clampWidth = useCallback((w: number) => {
    const viewportMax = Math.max(RESUME_SIDEBAR_MIN_WIDTH, window.innerWidth - 24);
    const maxAllowed = Math.min(RESUME_SIDEBAR_MAX_WIDTH, viewportMax);
    return Math.max(Math.min(w, maxAllowed), RESUME_SIDEBAR_MIN_WIDTH);
  }, []);

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
    // A drag that ends over the scrim doesn't close the panel: it started inside.
    const onUp = () => setResizing(false);
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

  const linkCls = buttonClass("secondary", "sm");
  return (
    <Drawer onClose={onClose} width={sidebarWidth}>
      <div
        className={`absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize z-20 group ${resizing ? "bg-primary/30" : ""}`}
        onMouseDown={handleResizeStart}
        title={`Drag to resize (${RESUME_SIDEBAR_MIN_WIDTH}px–${RESUME_SIDEBAR_MAX_WIDTH}px)`}
      >
        <div className="h-full w-full group-hover:bg-primary/20" />
      </div>
      <DrawerHeader
        title={name}
        actions={
          <>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
              Open in new tab
            </a>
            <a href={fileUrl} download={fileName} className={linkCls}>
              <Download size={14} strokeWidth={1.75} aria-hidden />
              Download
            </a>
          </>
        }
      />
      <iframe src={fileUrl} className="w-full flex-1 min-h-0" title={name} />
    </Drawer>
  );
}
