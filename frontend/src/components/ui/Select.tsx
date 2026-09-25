/** Shared select — a real listbox, not a styled <select> and not a menu of
 *  onClick actions. The list is a ui/Popover (portaled, layer-aware, animated),
 *  so it never fights a scrollable modal body and Escape closes it, not the
 *  dialog underneath. Keyboard: arrows/Home/End/Enter/Escape, optional search.
 *
 *  Two looks: "field" (default) matches form inputs and fills its container;
 *  "pill" is a compact rounded control for settings rows ("Group · Stage"). */
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import Popover, { itemClass } from "./Popover.tsx";

export interface SelectOption {
  value: string;
  label: string;
  /** Small muted second line (e.g. the role under a company name). */
  description?: string;
  /** Leading mark — a stage dot, a company logo. Also shown in the trigger. */
  icon?: ReactNode;
}

export default function Select({
  value, options, onChange, placeholder = "Select…", searchable, searchPlaceholder = "Search…",
  disabled, id, ariaLabel, renderValue, size = "md", variant = "field",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Override the closed-state rendering (defaults to selected label). */
  renderValue?: (selected: SelectOption | undefined) => ReactNode;
  /** "sm" for dense surfaces (filter panels); "md" matches form inputs. */
  size?: "sm" | "md";
  variant?: "field" | "pill";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
  }, [options, query]);

  const openList = () => { setQuery(""); setOpen(true); };

  // Start the keyboard cursor on the selected option each time the list opens/filters.
  useEffect(() => {
    if (!open) return;
    const i = filtered.findIndex((o) => o.value === value);
    setActiveIdx(query ? 0 : i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelectorAll("[role=option]")[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (open) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); break;
      case "Home": e.preventDefault(); setActiveIdx(0); break;
      case "End": e.preventDefault(); setActiveIdx(filtered.length - 1); break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && filtered[activeIdx]) commit(filtered[activeIdx].value);
        break;
      case "Tab": setOpen(false); break;
    }
  };

  const pill = variant === "pill";
  const triggerClass = pill
    ? "max-w-full h-7 pl-3 pr-2 text-[13px] inline-flex items-center gap-1.5 rounded-full bg-control border border-border text-foreground font-medium hover:border-muted-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    : `w-full ${size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 text-sm"} flex items-center justify-between gap-2 bg-background border border-border rounded-lg text-left text-foreground transition-shadow hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={triggerClass}
      >
        <span className={`min-w-0 inline-flex items-center gap-2 ${selected ? "" : "text-muted-foreground/60"}`}>
          {!renderValue && selected?.icon && <span className="shrink-0 inline-flex items-center justify-center">{selected.icon}</span>}
          <span className="truncate">{renderValue ? renderValue(selected) : selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={pill ? 13 : 15} strokeWidth={1.8} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        matchAnchorWidth={!pill}
        width={pill ? 220 : undefined}
        align={pill ? "end" : "start"}
        maxHeight={340}
        role="listbox"
        ariaLabel={ariaLabel}
        initialFocusRef={searchable ? searchRef : listRef}
        onKeyDown={onListKeyDown}
        className="flex flex-col"
      >
        {searchable && (
          <div className="px-1.5 pt-1.5 shrink-0">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-control/60">
              <Search size={13} strokeWidth={2} className="text-muted-foreground shrink-0" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
            </div>
          </div>
        )}
        <div ref={listRef} tabIndex={-1} className="p-1.5 overflow-y-auto min-h-0 outline-none">
          {filtered.length === 0 && (
            <p className="px-2.5 py-2 text-[13px] text-muted-foreground">No matches</p>
          )}
          {filtered.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value || `__empty-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(opt.value)}
                className={`${itemClass({ active: i === activeIdx })} ${isSelected ? "font-medium" : ""}`}
              >
                {opt.icon && <span className="min-w-4 shrink-0 inline-flex items-center justify-center">{opt.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="truncate leading-5">{opt.label}</p>
                  {opt.description && <p className="text-xs text-muted-foreground truncate font-normal">{opt.description}</p>}
                </div>
                <Check size={14} strokeWidth={2.5} className={`shrink-0 text-primary ${isSelected ? "" : "invisible"}`} aria-hidden />
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
