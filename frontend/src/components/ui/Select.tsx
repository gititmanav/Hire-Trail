/** Shared select — a real listbox, not a styled <select> and not a menu of
 *  onClick actions. Trigger matches Input height; the popover portals to
 *  <body> with fixed positioning so it never fights a scrollable modal body,
 *  and registers on the shared layer stack so Escape closes it — not the
 *  dialog underneath. Keyboard: arrows/Home/End/Enter/Escape, optional search. */
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { pushLayer, popLayer, isTopLayer } from "./layers.ts";

export interface SelectOption {
  value: string;
  label: string;
  /** Small muted second line (e.g. the role under a company name). */
  description?: string;
}

interface PopoverPos { top?: number; bottom?: number; left: number; width: number }

export default function Select({
  value, options, onChange, placeholder = "Select…", searchable, searchPlaceholder = "Search…",
  disabled, id, ariaLabel, renderValue, size = "md",
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
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const layerRef = useRef<symbol | null>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
  }, [options, query]);

  // Open lifecycle: layer registration, position, dismiss listeners.
  useEffect(() => {
    if (!open) return;
    const layer = pushLayer("select");
    layerRef.current = layer;

    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const dropUp = r.bottom + 324 > window.innerHeight && r.top > 344;
      setPos(dropUp
        ? { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width }
        : { top: r.bottom + 6, left: r.left, width: r.width });
    }
    setQuery("");
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Any outside scroll (incl. modal body) invalidates the fixed position — close.
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

  // Start the keyboard cursor on the selected option each time the list opens/filters.
  useEffect(() => {
    if (!open) return;
    setActiveIdx(filtered.findIndex((o) => o.value === value));
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
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (layerRef.current && isTopLayer(layerRef.current)) {
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
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
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`w-full ${size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 text-sm"} flex items-center justify-between gap-2 bg-background border border-border rounded-lg text-left text-foreground transition-shadow hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground/60"}`}>
          {renderValue ? renderValue(selected) : selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={1.8} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          onKeyDown={onKeyDown}
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className="z-[70] bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in"
        >
          {searchable && (
            <div className="flex items-center gap-2 px-3 h-9 border-b border-border">
              <Search size={13} strokeWidth={2} className="text-muted-foreground shrink-0" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>
          )}
          <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2.5 text-[13px] text-muted-foreground">No matches</p>
            )}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIdx;
              return (
                <div
                  key={opt.value || `__empty-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => commit(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                    isActive ? "bg-muted" : ""
                  } ${isSelected ? "font-medium" : ""} text-foreground`}
                >
                  <Check size={14} strokeWidth={2.5} className={`shrink-0 text-primary ${isSelected ? "" : "opacity-0"}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate leading-5">{opt.label}</p>
                    {opt.description && <p className="text-xs text-muted-foreground truncate">{opt.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
