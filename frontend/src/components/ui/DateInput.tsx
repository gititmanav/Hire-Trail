/** Shared date input — replaces raw <input type="date"> everywhere. The
 *  trigger shows a formatted date; the popover is the shared CalendarPicker
 *  (days, with a drill-up to months and years; full keyboard) plus Today /
 *  Clear. The popover is a ui/Popover (portaled, layer-aware, animated) like
 *  every other dropdown.
 *
 *  Value contract matches the native input it replaces: a local "YYYY-MM-DD"
 *  string or "". Conversions go through utils/dates.ts only, so no timezone
 *  can shift the day. */
import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import Popover from "./Popover.tsx";
import CalendarPicker, { type CalendarPickerHandle } from "./CalendarPicker.tsx";
import { formatDay, isYmd, todayYmd } from "../../utils/dates.ts";

export default function DateInput({
  value, onChange, id, required, disabled, ariaLabel, placeholder = "Pick a date", size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  /** "sm" for dense surfaces (filter bars); "md" matches form inputs. */
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<CalendarPickerHandle>(null);
  const valid = isYmd(value) ? value : "";

  // The picker takes focus once the panel is on screen (it remounts per open,
  // so it always starts on the selected day, or today).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => pickerRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const commit = (day: string) => {
    onChange(day);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

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
        className={`w-full ${size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 text-sm"} flex items-center justify-between gap-2 bg-background border border-border rounded-lg text-left text-foreground transition-shadow hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${valid ? "" : "text-muted-foreground/60"}`}>
          {valid ? formatDay(valid, { month: "short", day: "numeric", year: "numeric" }) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {valid && !required && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-control"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </span>
          )}
          <CalendarIcon size={15} strokeWidth={1.8} className="text-muted-foreground" aria-hidden />
        </span>
      </button>

      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        width={280}
        role="dialog"
        ariaLabel="Calendar"
        autoFocus={false}
        className="p-3"
      >
        <CalendarPicker ref={pickerRef} value={valid} onPick={commit} />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => commit(todayYmd())}
            className="text-xs font-medium text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
          >
            Today
          </button>
          {valid && !required && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
