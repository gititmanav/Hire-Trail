/**
 * Reusable action dropdown with outside-click closing.
 * Renders a trigger button and a positioned menu of items.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  /** Extra Tailwind classes for the item (e.g. text color) */
  className?: string;
  /** If true, a top divider is rendered before this item */
  divider?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Icon element to render before the label */
  icon?: React.ReactNode;
}

interface ActionDropdownProps {
  /** Items to render in the dropdown menu */
  items: DropdownItem[];
  /** Custom trigger element. If omitted, a default "Actions ▾" button is used. */
  trigger?: React.ReactNode;
  /** Label for the default trigger button (default: "Actions") */
  triggerLabel?: string;
  /** Additional class on the trigger button when using default trigger */
  triggerClassName?: string;
  /** Alignment of the dropdown menu relative to the trigger */
  align?: "left" | "right";
  /** Width class for the menu (default: "w-48") */
  menuWidth?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Enables a search box at the top of the menu */
  searchable?: boolean;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Max number of rows visible before scroll */
  maxVisibleItems?: number;
  /** Show only first N rows until user types search */
  defaultVisibleCount?: number;
}

export default function ActionDropdown({
  items,
  trigger,
  triggerLabel = "Actions",
  triggerClassName = "btn-secondary text-xs px-3 py-1.5",
  align = "right",
  menuWidth = "w-48",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  maxVisibleItems = 8,
  defaultVisibleCount,
}: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const shownItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      if (typeof defaultVisibleCount === "number") return items.slice(0, defaultVisibleCount);
      return items;
    }
    return items.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [items, query, defaultVisibleCount]);

  const listMaxHeight = `${Math.max(maxVisibleItems, 3) * 40}px`;

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => !disabled && setOpen((p) => !p)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setOpen((p) => !p)}
          disabled={disabled}
          className={triggerClassName}
        >
          {triggerLabel} <span className="ml-0.5">&#9662;</span>
        </button>
      )}

      {/* Menu */}
      {open && (
        <div
          className={`absolute z-20 mt-1 ${menuWidth} bg-card border border-border rounded-lg shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {searchable && (
            <div className="px-2 pb-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="input-premium !h-8 !px-2.5 !text-xs"
                autoFocus
              />
            </div>
          )}
          <div className="overflow-y-auto" style={{ maxHeight: listMaxHeight }}>
            {shownItems.map((item, i) => (
              <div key={`${item.label}-${i}`}>
                {item.divider && (
                  <div className="border-t border-border my-1" />
                )}
                <button
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      close();
                    }
                  }}
                  disabled={item.disabled}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                    item.disabled
                      ? "opacity-50 cursor-not-allowed text-muted-foreground"
                      : "hover:bg-muted"
                  } ${item.className || "text-foreground"}`}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  {item.label}
                </button>
              </div>
            ))}
            {shownItems.length === 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
