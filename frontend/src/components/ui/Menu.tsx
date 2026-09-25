/** Action menu on Popover — row actions, "More" menus, the user menu, and
 *  single-choice pickers that own a custom trigger (sort, filter chips).
 *
 *  Items carry icons, hints, checkmarks, section headings and dividers; the
 *  menu can open with a static header (who's signed in) and a search box.
 *  Keyboard: ↑/↓/Home/End move, Enter/Space run, typing filters (searchable),
 *  Escape closes. Items run their action and close the menu. The header and
 *  search stay put; only the items scroll, inside a capped height. */
import { ReactElement, ReactNode, cloneElement, useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";
import Popover, { PopoverDivider, PopoverLabel, itemClass } from "./Popover.tsx";

export interface MenuItem {
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  /** Single-choice menus ("Sort by", "Move to stage"): true shows the check.
   *  Leave undefined for plain actions. */
  checked?: boolean;
  hint?: ReactNode;
  destructive?: boolean;
  /** Softer caution than destructive ("Soft delete"). */
  warning?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  dividerBefore?: boolean;
  /** Section label above this item ("Sort by"). */
  heading?: ReactNode;
  /** What the search box matches when `label` isn't plain text. */
  searchText?: string;
}

type Trigger = ReactElement | ((open: boolean) => ReactElement);

export default function Menu({
  trigger, items, align = "start", width = 220, ariaLabel, header, searchable, searchPlaceholder = "Search…",
  emptyLabel = "No matches", disabled, maxHeight = 360,
}: {
  /** One element (or a function of the open state) — receives ref, onClick,
   *  and aria attributes. Must be a DOM element or forward its ref. */
  trigger: Trigger;
  items: MenuItem[];
  align?: "start" | "end";
  width?: number;
  ariaLabel: string;
  /** Static block above the items (e.g. the signed-in account). */
  header?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Cap on the panel height (the viewport is always a cap too). */
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const anchorRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const withIndex = items.map((item, index) => ({ item, index }));
    if (!q) return withIndex;
    return withIndex.filter(({ item }) => {
      const text = item.searchText ?? (typeof item.label === "string" ? item.label : "");
      return text.toLowerCase().includes(q);
    });
  }, [items, q]);
  const enabled = shown.filter(({ item }) => !item.disabled).map(({ index }) => index);

  const openMenu = (fromKeyboard: boolean) => {
    setQuery("");
    const checked = items.findIndex((it) => it.checked && !it.disabled);
    setActive(checked >= 0 ? checked : fromKeyboard ? (items.findIndex((it) => !it.disabled)) : -1);
    setOpen(true);
  };

  // Filtering moves the cursor to the first match.
  useEffect(() => { if (open && q) setActive(enabled[0] ?? -1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-menu-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const run = (i: number) => {
    const it = items[i];
    if (!it || it.disabled) return;
    setOpen(false);
    anchorRef.current?.focus({ preventScroll: true });
    it.onSelect();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const pos = enabled.indexOf(active);
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive(enabled[Math.min(pos + 1, enabled.length - 1)] ?? enabled[0] ?? -1); break;
      case "ArrowUp": e.preventDefault(); setActive(enabled[Math.max(pos - 1, 0)] ?? enabled[0] ?? -1); break;
      case "Home": e.preventDefault(); setActive(enabled[0] ?? -1); break;
      case "End": e.preventDefault(); setActive(enabled[enabled.length - 1] ?? -1); break;
      case "Enter": e.preventDefault(); if (active >= 0) run(active); break;
      // Space types into the search box; it only runs an item without one.
      case " ": if (!searchable) { e.preventDefault(); if (active >= 0) run(active); } break;
      case "Tab": setOpen(false); break;
    }
  };

  const base = typeof trigger === "function" ? trigger(open) : trigger;
  const triggerEl = cloneElement(base, {
    ref: anchorRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    disabled: disabled ?? base.props.disabled,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      base.props.onClick?.(e);
      if (disabled) return;
      if (open) setOpen(false); else openMenu(false);
    },
    onKeyDown: (e: KeyboardEvent) => {
      base.props.onKeyDown?.(e);
      if (disabled || open) return;
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu(true);
      }
    },
  });

  return (
    <>
      {triggerEl}
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        align={align}
        width={width}
        maxHeight={maxHeight}
        role="menu"
        ariaLabel={ariaLabel}
        initialFocusRef={searchable ? searchRef : listRef}
        onKeyDown={onKeyDown}
        className="flex flex-col"
        style={{ overflow: "hidden" }}
      >
        {header && <div className="shrink-0 px-3.5 pt-3 pb-2.5 border-b border-border">{header}</div>}
        {searchable && (
          <div className="shrink-0 px-1.5 pt-1.5">
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
        <div ref={listRef} tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1.5 outline-none">
          {shown.map(({ item: it, index: i }, pos) => (
            <div key={i}>
              {!q && it.dividerBefore && pos > 0 && <PopoverDivider />}
              {!q && it.heading && <PopoverLabel>{it.heading}</PopoverLabel>}
              <button
                type="button"
                role={it.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={it.checked === undefined ? undefined : it.checked}
                data-menu-index={i}
                disabled={it.disabled}
                tabIndex={-1}
                onMouseEnter={() => !it.disabled && setActive(i)}
                onClick={(e) => { e.stopPropagation(); run(i); }}
                className={itemClass({ active: i === active, disabled: it.disabled, destructive: it.destructive, warning: it.warning })}
              >
                {it.icon && <span className={`min-w-4 min-h-4 flex items-center justify-center shrink-0 ${it.destructive || it.warning ? "" : "text-muted-foreground"}`}>{it.icon}</span>}
                <span className="flex-1 min-w-0 truncate">{it.label}</span>
                {it.hint && <span className="text-[11.5px] text-muted-foreground shrink-0">{it.hint}</span>}
                {it.checked && <Check size={14} strokeWidth={2.5} className="text-primary shrink-0" aria-hidden />}
              </button>
            </div>
          ))}
          {shown.length === 0 && <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{emptyLabel}</p>}
        </div>
      </Popover>
    </>
  );
}
