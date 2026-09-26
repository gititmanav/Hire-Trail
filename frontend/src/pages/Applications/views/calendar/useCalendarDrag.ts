/** Drag to reschedule — pointer events, not native HTML5 drag (it swallows
 *  pointermove) and not dnd-kit's list sorting (a date grid wants arithmetic
 *  hit-testing: pointer → (row, col) → day).
 *
 *  - A drag starts after 4px of travel, so a click still clicks; the click
 *    that follows a drop is swallowed.
 *  - The preview is the truth: while dragging, the view lays the event out on
 *    the day under the pointer (`preview`), so what you see is what a drop saves.
 *  - Escape cancels; dropping on the origin day, outside the grid, or where the
 *    rules refuse (an applied date in the future) does nothing.
 *  - Mouse and pen only — on touch the same gesture scrolls. */
import { useCallback, useEffect, useRef, useState } from "react";
import { canDrop, isDraggable, type CalendarEvent } from "../../../../utils/calendarGrid.ts";
import type { Ymd } from "../../../../utils/dates.ts";

const THRESHOLD = 4;

export interface DragState {
  event: CalendarEvent;
  origin: Ymd;
  /** The day under the pointer, or null outside the grid. */
  day: Ymd | null;
  allowed: boolean;
}

export function useCalendarDrag({ today, dayAtPoint, onDrop }: {
  today: Ymd;
  /** The day under a viewport point for the active view, or null. */
  dayAtPoint: (x: number, y: number) => Ymd | null;
  onDrop: (event: CalendarEvent, day: Ymd, origin: Ymd) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<{ event: CalendarEvent; x: number; y: number } | null>(null);
  const live = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  // Latest callbacks without re-binding window listeners mid-drag.
  const cb = useRef({ dayAtPoint, onDrop, today });
  cb.current = { dayAtPoint, onDrop, today };

  const cleanup = useCallback(() => {
    pending.current = null;
    live.current = null;
    setDrag(null);
    document.documentElement.classList.remove("cal-dragging", "cal-drag-denied");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", cancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(x: number, y: number) {
    const cur = live.current!;
    const day = cb.current.dayAtPoint(x, y);
    const allowed = !!day && canDrop(cur.event, day, cb.current.today);
    if (day === cur.day && allowed === cur.allowed) return;
    live.current = { ...cur, day, allowed };
    setDrag(live.current);
    document.documentElement.classList.toggle("cal-drag-denied", !!day && !allowed);
  }

  function onMove(e: PointerEvent) {
    const p = pending.current;
    if (!live.current) {
      if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD) return;
      live.current = { event: p.event, origin: p.event.date, day: p.event.date, allowed: true };
      setDrag(live.current);
      document.documentElement.classList.add("cal-dragging");
      window.getSelection()?.removeAllRanges();
    }
    update(e.clientX, e.clientY);
  }

  function onUp() {
    const d = live.current;
    cleanup();
    if (!d) return; // a plain click — let it through
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    if (d.day && d.allowed && d.day !== d.origin) cb.current.onDrop(d.event, d.day, d.origin);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !live.current) return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  }

  function cancel() {
    const wasLive = !!live.current;
    cleanup();
    if (wasLive) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  }

  const onPointerDown = useCallback((e: React.PointerEvent, event: CalendarEvent) => {
    if (e.button !== 0 || e.pointerType === "touch" || !isDraggable(event)) return;
    pending.current = { event, x: e.clientX, y: e.clientY };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", cancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** True right after a drag ended — the chip's click handler ignores it. */
  const swallowClick = useCallback(() => suppressClick.current, []);

  return { drag, onPointerDown, swallowClick };
}
