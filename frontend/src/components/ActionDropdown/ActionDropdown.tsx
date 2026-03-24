/**
 * Reusable action dropdown with outside-click closing.
 * Renders a trigger button and a positioned menu of items.
 */
import { useState, useRef, useEffect, useCallback } from "react";

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
}

export default function ActionDropdown({
  items,
  trigger,
  triggerLabel = "Actions",
  triggerClassName = "btn-secondary text-xs px-3 py-1.5",
  align = "right",
  menuWidth = "w-48",
  disabled = false,
}: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
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
          className={`absolute z-50 mt-1 ${menuWidth} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && (
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              )}
              <button
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    close();
                  }
                }}
                disabled={item.disabled}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  item.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${item.className || "text-gray-700 dark:text-gray-300"}`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
