/** Small single-choice switch (radiogroup) — Active | Archived, grouping, the
 *  calendar's Day | Week | Month. Arrow keys move the selection, like native
 *  radios. The selected fill is one pill that slides between segments
 *  (measured, so segments can differ in width); no slide under reduced motion. */
import { ReactNode, KeyboardEvent, useLayoutEffect, useRef, useState } from "react";

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional trailing count ("Active 23"). */
  count?: number;
}

export default function SegmentedControl<T extends string>({
  value, onChange, segments, ariaLabel, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  segments: Segment<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // The first placement doesn't animate — the pill appears where it belongs.
  const placed = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!el) { setPill(null); return; }
      setPill((p) => (p && p.left === el.offsetLeft && p.width === el.offsetWidth ? p : { left: el.offsetLeft, width: el.offsetWidth }));
    };
    measure();
    // Labels can change width (counts arriving, fonts loading).
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, segments]);
  useLayoutEffect(() => { if (pill) placed.current = true; }, [pill]);

  const onKeyDown = (e: KeyboardEvent) => {
    const i = segments.findIndex((s) => s.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(segments[(i + 1) % segments.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(segments[(i - 1 + segments.length) % segments.length].value);
    }
  };
  return (
    <div ref={trackRef} role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className="relative inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border">
      {pill && (
        <span
          aria-hidden
          className={`absolute top-0.5 bottom-0.5 left-0 rounded-md bg-control ${placed.current ? "transition-[transform,width] duration-200 ease-smooth motion-reduce:transition-none" : ""}`}
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(s.value)}
            className={`relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              size === "sm" ? "h-6 px-2 text-[12px]" : "h-7 px-2.5 text-[12.5px]"
            } ${active ? `text-foreground ${pill ? "" : "bg-control"}` : "text-muted-foreground hover:text-foreground hover:bg-control/60"}`}
          >
            {s.label}
            {s.count != null && <span className="tabular-nums text-muted-foreground text-[11px]">{s.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
