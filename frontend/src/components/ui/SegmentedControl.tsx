/** Small single-choice switch (radiogroup) — Active | Archived, grouping, etc.
 *  Arrow keys move the selection, like native radios. */
import { ReactNode, KeyboardEvent } from "react";

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
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border">
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
            className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              size === "sm" ? "h-6 px-2 text-[12px]" : "h-7 px-2.5 text-[12.5px]"
            } ${active ? "bg-control text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-control/60"}`}
          >
            {s.label}
            {s.count != null && <span className="tabular-nums text-muted-foreground text-[11px]">{s.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
