/** Shared date input — replaces raw <input type="date"> everywhere. Trigger
 *  shows a formatted date; the popover is a month calendar with keyboard nav
 *  (arrows move a day, PageUp/Down a month, Enter selects, Escape closes) and
 *  Today/Clear footer actions.
 *
 *  Value contract matches the native input it replaces: a local "YYYY-MM-DD"
 *  string or "". All math uses (year, month, day) constructors — never
 *  Date-parsing of strings — so timezones can't shift the day. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { pushLayer, popLayer, isTopLayer } from "./layers.ts";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parse(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}
const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayParts = () => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
};

function formatDisplay(value: string): string {
  const p = parse(value);
  if (!p) return "";
  return new Date(p.y, p.m, p.d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DateInput({
  value, onChange, id, required, disabled, ariaLabel, placeholder = "Pick a date",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<symbol | null>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  /** The month shown + the keyboard cursor day. */
  const [view, setView] = useState(() => parse(value) ?? todayParts());
  const [cursor, setCursor] = useState(() => parse(value) ?? todayParts());

  useEffect(() => {
    if (!open) return;
    const layer = pushLayer("calendar");
    layerRef.current = layer;
    const start = parse(value) ?? todayParts();
    setView(start);
    setCursor(start);
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const dropUp = r.bottom + 356 > window.innerHeight && r.top > 372;
      setPos(dropUp
        ? { bottom: window.innerHeight - r.top + 6, left: r.left }
        : { top: r.bottom + 6, left: r.left });
    }
    requestAnimationFrame(() => gridRef.current?.focus());
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      popLayer(layer);
      layerRef.current = null;
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const moveCursor = (days: number) => {
    const next = new Date(cursor.y, cursor.m, cursor.d + days);
    const parts = { y: next.getFullYear(), m: next.getMonth(), d: next.getDate() };
    setCursor(parts);
    setView({ ...parts, d: 1 });
  };
  const moveMonth = (delta: number, from = view) => {
    const next = new Date(from.y, from.m + delta, 1);
    setView({ y: next.getFullYear(), m: next.getMonth(), d: 1 });
  };

  const commit = (y: number, m: number, d: number) => {
    onChange(toValue(y, m, d));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); moveCursor(-1); break;
      case "ArrowRight": e.preventDefault(); moveCursor(1); break;
      case "ArrowUp": e.preventDefault(); moveCursor(-7); break;
      case "ArrowDown": e.preventDefault(); moveCursor(7); break;
      case "PageUp": e.preventDefault(); moveMonth(-1, cursor); moveCursor(-30); break;
      case "PageDown": e.preventDefault(); moveMonth(1, cursor); moveCursor(30); break;
      case "Enter": case " ": e.preventDefault(); commit(cursor.y, cursor.m, cursor.d); break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (layerRef.current && isTopLayer(layerRef.current)) {
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
      case "Tab": setOpen(false); break;
    }
  };

  const t = todayParts();
  const sel = parse(value);
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? "Choose date"}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 flex items-center justify-between gap-2 text-sm bg-background border border-border rounded-lg text-left text-foreground transition-shadow hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${value ? "" : "text-muted-foreground/60"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && !required && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </span>
          )}
          <CalendarIcon size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden />
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Calendar"
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom }}
          className="z-[70] w-[280px] bg-popover border border-border rounded-xl shadow-lg p-3 animate-in"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronLeft size={15} strokeWidth={2} aria-hidden />
            </button>
            <span className="text-[13px] font-semibold text-foreground select-none" aria-live="polite">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight size={15} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <span key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-muted-foreground select-none">{d}</span>
            ))}
          </div>

          <div
            ref={gridRef}
            tabIndex={0}
            role="grid"
            aria-label={`${MONTHS[view.m]} ${view.y}`}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-y-0.5 focus:outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {cells.map((day, i) => {
              if (day === null) return <span key={`pad-${i}`} />;
              const isToday = view.y === t.y && view.m === t.m && day === t.d;
              const isSelected = !!sel && view.y === sel.y && view.m === sel.m && day === sel.d;
              const isCursor = view.y === cursor.y && view.m === cursor.m && day === cursor.d;
              return (
                <button
                  key={day}
                  type="button"
                  tabIndex={-1}
                  aria-label={toValue(view.y, view.m, day)}
                  aria-pressed={isSelected}
                  onClick={() => commit(view.y, view.m, day)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isToday
                        ? "border border-primary/50 text-primary font-medium hover:bg-primary/10"
                        : "text-foreground hover:bg-muted"
                  } ${isCursor && !isSelected ? "ring-1 ring-ring/50" : ""}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => commit(t.y, t.m, t.d)}
              className="text-xs font-medium text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
            >
              Today
            </button>
            {value && !required && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
              >
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
