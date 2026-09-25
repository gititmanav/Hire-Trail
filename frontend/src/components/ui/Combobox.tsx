/** Suggestion list under a text input — the company picker, the resume tag
 *  input, the admin model-id field. The input stays the caller's (its value,
 *  chips, free-text rules); this renders the list on ui/Popover, keeps focus
 *  in the input, and gives every combobox the same keyboard: ↑/↓ move,
 *  Enter picks, Escape closes the list (never the dialog around it). */
import { ReactNode, RefObject, useEffect, useRef } from "react";
import Popover, { PopoverDivider, itemClass } from "./Popover.tsx";

export interface ComboboxOption {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  /** Trailing muted detail ("3 apps"). */
  hint?: ReactNode;
  /** Accent text — "Create "Acme"". */
  tone?: "primary";
  /** Emphasize the option matching the current value. */
  current?: boolean;
  dividerBefore?: boolean;
}

export function ComboboxList({
  open, onOpenChange, anchorRef, options, activeIndex, onActiveIndexChange, status, ariaLabel, id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element wrapping the input — clicks inside it never close the list. */
  anchorRef: RefObject<HTMLElement>;
  options: ComboboxOption[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  /** Shown instead of (or above) options: "Searching…", "Type to search". */
  status?: ReactNode;
  ariaLabel: string;
  /** Prefix for option ids, so the input can point aria-activedescendant at them. */
  id?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-combo-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <Popover
      open={open && (options.length > 0 || !!status)}
      onOpenChange={onOpenChange}
      anchorRef={anchorRef}
      matchAnchorWidth
      maxHeight={280}
      role="listbox"
      ariaLabel={ariaLabel}
      id={id}
      autoFocus={false}
    >
      <div ref={listRef} className="p-1.5">
        {status && <p className="px-2.5 py-2 text-[12.5px] text-muted-foreground">{status}</p>}
        {options.map((o, i) => (
          <div key={o.key}>
            {o.dividerBefore && i > 0 && <PopoverDivider />}
            <div
              id={id ? `${id}-opt-${i}` : undefined}
              role="option"
              aria-selected={i === activeIndex}
              data-combo-index={i}
              // Keep focus (and the caret) in the input while picking.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onActiveIndexChange(i)}
              onClick={o.onSelect}
              className={`${itemClass({ active: i === activeIndex })} ${o.tone === "primary" ? "!text-primary" : ""} ${o.current ? "font-medium" : ""}`}
            >
              {o.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">{o.icon}</span>}
              <span className="flex-1 min-w-0 truncate">{o.label}</span>
              {o.hint && <span className="text-[11.5px] text-muted-foreground shrink-0">{o.hint}</span>}
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}

/** Shared input keyboard for a ComboboxList. Returns true when it handled
 *  the key (the caller skips its own handling then). */
export function handleComboboxKey(
  e: React.KeyboardEvent,
  { open, setOpen, count, active, setActive, pick }: {
    open: boolean;
    setOpen: (open: boolean) => void;
    count: number;
    active: number;
    setActive: (i: number) => void;
    /** Run the option at `active`. */
    pick: (i: number) => void;
  },
): boolean {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!open) { setOpen(true); return true; }
      if (count > 0) setActive(active < 0 ? 0 : Math.min(active + 1, count - 1));
      return true;
    case "ArrowUp":
      e.preventDefault();
      if (count > 0) setActive(Math.max(active - 1, 0));
      return true;
    case "Enter":
      if (open && active >= 0 && active < count) {
        e.preventDefault();
        pick(active);
        return true;
      }
      return false;
    default:
      return false;
  }
}
