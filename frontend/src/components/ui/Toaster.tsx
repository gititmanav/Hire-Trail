/** Draws the toasts from toast.ts — mounted once, in main.tsx.
 *
 *  Bottom-right (full width on phones). The newest toast sits in front and the
 *  older ones tuck in behind it, each a little narrower, peeking above. Hover
 *  or keyboard focus fans the stack out and holds every timer (so does a
 *  hidden tab). A toast rises softly from below, a closing one drops away,
 *  and one can be swiped down to close it. Motion is transform/height only,
 *  and a plain fade under prefers-reduced-motion (App.css → Toasts). */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheckBig, Info, TriangleAlert, X } from "lucide-react";

import { getToasts, pauseToasts, resumeToasts, subscribeToasts, toast, TOAST_LIMIT, type ToastItem, type ToastTone } from "./toast.ts";

/** Space between cards when the stack is fanned out. */
const GAP = 8;
/** How far each tucked card shows above the one in front of it. */
const PEEK = 10;
/** How much narrower each tucked card is. */
const SHRINK = 0.05;
/** A swipe this far down closes the toast. */
const SWIPE_CLOSE_PX = 48;

const spinner = (
  <span className="block w-[15px] h-[15px] rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
);

const TONE: Record<ToastTone, { border: string; title: string; icon: ReactNode }> = {
  default: {
    border: "border-border",
    title: "text-foreground",
    icon: <Info size={17} strokeWidth={2} className="text-muted-foreground" aria-hidden />,
  },
  success: {
    border: "border-emerald-600/30 dark:border-emerald-400/30",
    title: "text-emerald-700 dark:text-emerald-400",
    icon: <CircleCheckBig size={17} strokeWidth={2} aria-hidden />,
  },
  warning: {
    border: "border-amber-500/45 dark:border-amber-400/30",
    title: "text-amber-700 dark:text-amber-400",
    icon: <TriangleAlert size={17} strokeWidth={2} aria-hidden />,
  },
  error: {
    border: "border-red-600/30 dark:border-red-400/30",
    title: "text-red-700 dark:text-red-400",
    icon: <CircleAlert size={17} strokeWidth={2} aria-hidden />,
  },
  loading: {
    border: "border-border",
    title: "text-foreground",
    icon: <span className="text-muted-foreground">{spinner}</span>,
  },
};

interface Slot {
  y: number;
  scale: number;
  height?: number;
  z: number;
  tucked: boolean;
  hidden: boolean;
}

function ToastCard({ item, slot, onHeight }: { item: ToastItem; slot: Slot; onHeight: (key: string, h: number | null) => void }) {
  const [entered, setEntered] = useState(false);
  const cardRef = useRef<HTMLLIElement>(null);
  const swipe = useRef<{ startY: number; dy: number; id: number } | null>(null);
  const tone = TONE[item.tone];

  // Rise in on the frame after mount (the first frame paints the start pose).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // The card's natural height (body + border), re-read whenever its content
  // changes. A callback ref, so the observer lives exactly as long as the node.
  const observer = useRef<ResizeObserver | null>(null);
  const bodyRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) { onHeight(item.key, null); return; }
    const measure = () => onHeight(item.key, el.offsetHeight + 2);
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, [item.key, onHeight]);

  /* Swipe down to close. Styles are written straight to the node while
     dragging — no React state per frame. */
  const onPointerDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (e.button !== 0 || item.leaving || slot.tucked) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    swipe.current = { startY: e.clientY, dy: 0, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    const s = swipe.current;
    const el = cardRef.current;
    if (!s || !el || s.id !== e.pointerId) return;
    const raw = e.clientY - s.startY;
    if (!el.hasAttribute("data-swiping")) {
      if (Math.abs(raw) < 4) return;
      el.setPointerCapture(e.pointerId);
      el.setAttribute("data-swiping", "");
    }
    s.dy = raw > 0 ? raw : raw / 6; // upward gives a little, then resists
    el.style.setProperty("--swipe", `${s.dy}px`);
  };
  const onPointerEnd = () => {
    const s = swipe.current;
    const el = cardRef.current;
    swipe.current = null;
    if (!s || !el || !el.hasAttribute("data-swiping")) return;
    el.removeAttribute("data-swiping");
    if (s.dy > SWIPE_CLOSE_PX) toast.dismiss(item.id);
    else el.style.setProperty("--swipe", "0px");
  };

  const y = item.leaving ? slot.y + 16 : slot.y;
  const transform = entered
    ? `translateY(calc(${y}px + var(--swipe, 0px))) scale(${slot.scale})`
    : "translateY(100%)";

  return (
    <li
      ref={cardRef}
      role={item.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      data-entered={entered || undefined}
      data-leaving={item.leaving || undefined}
      data-tucked={slot.tucked || undefined}
      className={`toast absolute inset-x-0 bottom-0 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-floating ${tone.border}`}
      style={{
        transform,
        height: slot.height,
        zIndex: slot.z,
        opacity: !entered || item.leaving || slot.hidden ? 0 : 1,
        pointerEvents: item.leaving || slot.hidden ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={bodyRef} className="toast-body flex items-start gap-3 py-3 pl-3.5 pr-2.5">
        <span className={`mt-px shrink-0 grid place-items-center w-[18px] h-[18px] ${tone.title}`}>{tone.icon}</span>
        <div className="min-w-0 flex-1 py-px">
          <p className={`text-[13.5px] font-medium leading-snug break-words ${tone.title}`}>{item.title}</p>
          {item.description && (
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground break-words">{item.description}</p>
          )}
        </div>
        {item.action && (
          <button
            type="button"
            onClick={() => { toast.dismiss(item.id); item.action?.onClick(); }}
            className="shrink-0 h-7 px-2.5 -my-0.5 rounded-md border border-border bg-background text-[12.5px] font-medium text-foreground hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => toast.dismiss(item.id)}
          aria-label="Close notification"
          className="shrink-0 grid place-items-center w-6 h-6 -mr-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export default function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const hovering = useRef(false);
  const keyboardFocus = useRef(false);
  /** Where each card last sat, so a closing one leaves from there. */
  const lastSlots = useRef(new Map<string, Slot>());

  const onHeight = useCallback((key: string, h: number | null) => {
    setHeights((prev) => {
      if (h === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev[key] === h ? prev : { ...prev, [key]: h };
    });
  }, []);

  /** Hold the timers while anyone is reading the stack. */
  const sync = useCallback(() => {
    const reading = hovering.current || keyboardFocus.current;
    if (reading || document.hidden) pauseToasts();
    else resumeToasts();
    setExpanded(reading);
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [sync]);

  const stack = items.slice().reverse(); // newest first
  const open = stack.filter((t) => !t.leaving);

  // A card closed from under the pointer (or the focused button) never fires
  // a "leave" — let go once nothing is left, or focus has fallen out.
  useEffect(() => {
    let changed = false;
    if (open.length === 0 && hovering.current) { hovering.current = false; changed = true; }
    if (keyboardFocus.current && !listRef.current?.contains(document.activeElement)) { keyboardFocus.current = false; changed = true; }
    if (changed) sync();
  }, [open.length, items, sync]);

  if (items.length === 0) return null;

  const front = open[0];
  const frontHeight = front ? heights[front.key] : undefined;
  const slots = new Map<string, Slot>();
  let lifted = 0;
  open.forEach((t, i) => {
    const h = heights[t.key];
    const slot: Slot = expanded
      ? { y: -lifted, scale: 1, height: h, z: open.length - i, tucked: false, hidden: i >= TOAST_LIMIT }
      : { y: -i * PEEK, scale: 1 - i * SHRINK, height: i === 0 ? h : frontHeight, z: open.length - i, tucked: i > 0, hidden: i >= TOAST_LIMIT };
    lifted += (h ?? 0) + GAP;
    slots.set(t.key, slot);
    lastSlots.current.set(t.key, slot);
  });
  for (const key of lastSlots.current.keys()) {
    if (!items.some((t) => t.key === key)) lastSlots.current.delete(key);
  }
  const listHeight = expanded ? Math.max(0, lifted - GAP) : frontHeight ?? 0;

  return createPortal(
    <section aria-label="Notifications" className="toaster">
      <ol
        ref={listRef}
        className="toaster-list"
        data-expanded={expanded || undefined}
        style={{ height: listHeight }}
        onMouseEnter={() => { hovering.current = true; sync(); }}
        onMouseLeave={() => { hovering.current = false; sync(); }}
        onFocus={(e) => {
          // Keyboard focus only — a click's focus can outlive the card it hit.
          if ((e.target as HTMLElement).matches(":focus-visible")) { keyboardFocus.current = true; sync(); }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { keyboardFocus.current = false; sync(); }
        }}
      >
        {stack.map((t) => {
          const slot = slots.get(t.key) ?? lastSlots.current.get(t.key) ?? { y: 0, scale: 1, z: 0, tucked: false, hidden: false };
          return <ToastCard key={t.key} item={t} slot={slot} onHeight={onHeight} />;
        })}
      </ol>
    </section>,
    document.body,
  );
}
