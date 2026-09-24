/** Controls that live in the Applications page header. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, Columns3, LayoutList, Rows3, Search, SquarePen, X, type LucideIcon } from "lucide-react";
import Tooltip from "../../../components/ui/Tooltip.tsx";

/* ─── Search ─── */

export interface SearchFieldHandle { focus: () => void }

/** Debounced search box bound to the `q` filter. Escape clears and blurs. */
export const SearchField = forwardRef<SearchFieldHandle, { value: string; onChange: (v: string) => void }>(
  function SearchField({ value, onChange }, ref) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

    // Follow external changes (back/forward, "Clear filters") when not typing.
    useEffect(() => {
      if (document.activeElement !== inputRef.current) setDraft(value);
    }, [value]);

    useEffect(() => {
      if (draft === value) return;
      const t = window.setTimeout(() => onChange(draft), 250);
      return () => window.clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft]);

    return (
      <div className="relative">
        <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft("");
              onChange("");
              inputRef.current?.blur();
            }
          }}
          placeholder="Search company or role"
          aria-label="Search applications"
          className="h-8 w-44 focus:w-60 sm:w-52 sm:focus:w-64 pl-8 pr-7 text-[13px] bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/70 transition-[width,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {draft ? (
          <button
            type="button"
            onClick={() => { setDraft(""); onChange(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={12} strokeWidth={2.5} aria-hidden />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] font-mono text-muted-foreground/70 pointer-events-none">/</kbd>
        )}
      </div>
    );
  },
);

/* ─── View switcher ─── */

export type ViewKey = "list" | "board" | "calendar";

export const VIEWS: { key: ViewKey; path: string; label: string; Icon: LucideIcon; shortcut: string }[] = [
  { key: "list", path: "/applications", label: "List", Icon: LayoutList, shortcut: "1" },
  { key: "board", path: "/applications/board", label: "Board", Icon: Columns3, shortcut: "2" },
  { key: "calendar", path: "/applications/calendar", label: "Calendar", Icon: CalendarDays, shortcut: "3" },
];

export function ViewSwitcher({ views, search }: { views: typeof VIEWS; search: string }) {
  return (
    <nav aria-label="Views" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/50">
      {views.map((v) => (
        <Tooltip key={v.key} label={`${v.label} view`} shortcut={v.shortcut}>
          <NavLink
            to={{ pathname: v.path, search }}
            end
            aria-label={`${v.label} view`}
            className={({ isActive }) =>
              `w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <v.Icon size={15} strokeWidth={1.8} aria-hidden />
          </NavLink>
        </Tooltip>
      ))}
    </nav>
  );
}

/* ─── List design toggle (development aid — compare Classic vs Table) ─── */

export type ListDesign = "classic" | "table";

export function DesignToggle({ value, onChange }: { value: ListDesign; onChange: (d: ListDesign) => void }) {
  const next: ListDesign = value === "classic" ? "table" : "classic";
  return (
    <Tooltip label={`Switch to the ${next === "table" ? "full-width table" : "classic card"} design`}>
      <button
        type="button"
        onClick={() => onChange(next)}
        aria-label={`List design: ${value}. Switch to ${next}.`}
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 text-[12px] font-medium text-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Rows3 size={13} strokeWidth={2} aria-hidden />
        {value === "classic" ? "Classic" : "Table"}
      </button>
    </Tooltip>
  );
}

/* ─── Create ─── */

export function CreateButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip label="New application" shortcut="C">
      <button
        type="button"
        onClick={onClick}
        aria-label="New application"
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SquarePen size={15} strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}
