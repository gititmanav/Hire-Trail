/** Shared slider — the one range control (no native `<input type="range">`,
 *  whose look belongs to the OS). role="slider" with the full keyboard:
 *  arrows step, Shift+arrows and PageUp/PageDown step ×10, Home/End jump.
 *  Dragging reports every move through `onChange` and the final value
 *  through `onCommit` (pointer capture keeps the drag going past the edges
 *  and keeps the release inside any popover the slider lives in). */
import { CSSProperties, KeyboardEvent, PointerEvent, useEffect, useRef } from "react";

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Every change, live (a drag reports each move). */
  onChange: (value: number) => void;
  /** The value the user settled on — pointer released, key pressed. */
  onCommit?: (value: number) => void;
  label: string;
  valueText?: string;
  /** Replaces the default track fill (e.g. the hue gradient). */
  trackStyle?: CSSProperties;
  /** Colour inside the thumb (the hue slider shows the hue). */
  thumbColor?: string;
  className?: string;
}

export default function Slider({
  value, min = 0, max = 100, step = 1, onChange, onCommit, label, valueText, trackStyle, thumbColor, className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // The latest value, ahead of the prop: keys pressed faster than React
  // renders (or a drag) each build on the one before.
  const last = useRef(value);
  useEffect(() => { if (!dragging.current) last.current = value; }, [value]);

  const decimals = (String(step).split(".")[1] ?? "").length;
  const snap = (v: number) => +Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min)).toFixed(decimals);
  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return snap(min + ((clientX - r.left) / r.width) * (max - min));
  };
  const report = (v: number) => {
    if (v === last.current) return;
    last.current = v;
    onChange(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current?.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    report(fromPointer(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) report(fromPointer(e.clientX));
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit?.(last.current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = step * 10;
    const from = last.current;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? from + (e.shiftKey ? big : step)
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? from - (e.shiftKey ? big : step)
      : e.key === "PageUp" ? from + big
      : e.key === "PageDown" ? from - big
      : e.key === "Home" ? min
      : e.key === "End" ? max
      : null;
    if (next === null) return;
    e.preventDefault();
    const v = snap(next);
    last.current = v;
    onChange(v);
    onCommit?.(v);
  };

  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={`group relative h-5 flex items-center cursor-pointer touch-none select-none rounded-full focus:outline-none ${className}`}
    >
      <div className="relative h-1.5 w-full rounded-full bg-control" style={trackStyle}>
        {!trackStyle && <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />}
      </div>
      <span
        aria-hidden
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-primary shadow-[0_0_0_1px_hsl(var(--scrim)/0.25),0_1px_3px_hsl(var(--scrim)/0.2)] transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
        style={{ left: `${pct}%`, ...(thumbColor ? { background: thumbColor } : null) }}
      />
    </div>
  );
}
