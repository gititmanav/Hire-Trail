/** Action menu on Popover: trigger + items with icons, checkmarks, dividers,
 *  and full keyboard support (↑/↓/Home/End to move, Enter to run, Escape to
 *  close). Items run their action and close the menu. */
import { ReactElement, ReactNode, cloneElement, useRef, useState, KeyboardEvent } from "react";
import { Check } from "lucide-react";
import Popover from "./Popover.tsx";

export interface MenuItem {
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  /** Shows a trailing check (single-choice menus like "Move to stage"). */
  checked?: boolean;
  hint?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  dividerBefore?: boolean;
}

export default function Menu({
  trigger, items, align = "start", width = 220, ariaLabel,
}: {
  /** A single element; receives ref, onClick, and aria attributes. */
  trigger: ReactElement;
  items: MenuItem[];
  align?: "start" | "end";
  width?: number;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const anchorRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  const openMenu = () => {
    setActive(items.findIndex((it) => it.checked && !it.disabled));
    setOpen(true);
  };

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
      case "ArrowDown": e.preventDefault(); setActive(enabled[Math.min(pos + 1, enabled.length - 1)] ?? enabled[0]); break;
      case "ArrowUp": e.preventDefault(); setActive(enabled[Math.max(pos - 1, 0)] ?? enabled[0]); break;
      case "Home": e.preventDefault(); setActive(enabled[0]); break;
      case "End": e.preventDefault(); setActive(enabled[enabled.length - 1]); break;
      case "Enter": case " ": e.preventDefault(); if (active >= 0) run(active); break;
      case "Tab": setOpen(false); break;
    }
  };

  const triggerEl = cloneElement(trigger, {
    ref: anchorRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      trigger.props.onClick?.(e);
      if (open) setOpen(false); else openMenu();
    },
    onKeyDown: (e: KeyboardEvent) => {
      trigger.props.onKeyDown?.(e);
      if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openMenu();
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
        role="menu"
        ariaLabel={ariaLabel}
        initialFocusRef={listRef}
        className="p-1"
      >
        <div ref={listRef} tabIndex={-1} onKeyDown={onKeyDown} className="outline-none">
          {items.map((it, i) => (
            <div key={i}>
              {it.dividerBefore && <div className="my-1 h-px bg-border" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                tabIndex={-1}
                onMouseEnter={() => !it.disabled && setActive(i)}
                onClick={(e) => { e.stopPropagation(); run(i); }}
                className={`w-full flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-[13px] text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  i === active ? "bg-muted" : ""
                } ${it.destructive ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
              >
                {it.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">{it.icon}</span>}
                <span className="flex-1 min-w-0 truncate">{it.label}</span>
                {it.hint && <span className="text-[11px] text-muted-foreground shrink-0">{it.hint}</span>}
                {it.checked && <Check size={14} strokeWidth={2.5} className="text-primary shrink-0" aria-hidden />}
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
