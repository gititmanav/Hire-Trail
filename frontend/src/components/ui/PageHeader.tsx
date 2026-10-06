/** Every page's sub-header, and the controls that live in it.
 *
 *  PageHeader: title (+ quiet meta) on the left, page actions on the right.
 *  It is the main section's sub-header: pinned to the top of the scrolling
 *  card and bled to its edges so the hairline spans the page — so it must be
 *  the page's first element, outside any max-width column (put the column in
 *  PageBody below it). Publishes its live height as --page-header-h so sticky
 *  bars below it (list group strips, section tabs) pin flush beneath it at
 *  any wrap state.
 *
 *  The controls, in the order pages place them: PageSearch ("/"), a view or
 *  tab switch (SegmentedControl, Applications' ViewSwitcher), Filters
 *  (ui/FiltersPopover, "f"), small HeaderIconButtons, CreateButton ("c"). */
import { forwardRef, ReactNode, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { Search, SquarePen, X } from "lucide-react";
import Tooltip from "./Tooltip.tsx";

export default function PageHeader({ title, meta, actions, titleAs: TitleTag = "h1" }: {
  title: ReactNode;
  /** "div" when the page's real heading lives below (e.g. a detail page whose
   *  header carries a breadcrumb). */
  titleAs?: "h1" | "div";
  /** Muted, tabular detail next to the title — e.g. "23 active". */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    // Only on a real change: a custom property on <html> restyles the whole
    // document, and width-only resizes (the sidebar animating) must stay cheap.
    let last = -1;
    const publish = () => {
      const h = el.offsetHeight;
      if (h === last) return;
      last = h;
      root.style.setProperty("--page-header-h", `${h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--page-header-h"); };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-5 px-4 md:px-6 bg-background border-b border-border">
      <div className="min-h-14 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <TitleTag className="text-base font-semibold text-foreground truncate">{title}</TitleTag>
          {meta && <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{meta}</span>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">{actions}</div>}
      </div>
    </div>
  );
}

const BODY_WIDTH = { md: "max-w-3xl", lg: "max-w-4xl", xl: "max-w-[1200px]", "2xl": "max-w-[1320px]" } as const;

/** The page's content column under its header (the header itself spans the card). */
export function PageBody({ size = "xl", className = "", children }: { size?: keyof typeof BODY_WIDTH; className?: string; children: ReactNode }) {
  return <div className={`${BODY_WIDTH[size]} mx-auto ${className}`}>{children}</div>;
}

/* ─── Search ─── */

export interface PageSearchHandle { focus: () => void }

/** The header's search box: debounced, "/" to focus (the page binds it),
 *  Escape clears and blurs. */
export const PageSearch = forwardRef<PageSearchHandle, { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string }>(
  function PageSearch({ value, onChange, placeholder, ariaLabel }, ref) {
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
          placeholder={placeholder}
          aria-label={ariaLabel}
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

/* ─── Buttons ─── */

/** A square, bordered icon button for the header (lock, widgets…). `active`
 *  is the on state — the same look as an engaged Filters button. */
export const HeaderIconButton = forwardRef<HTMLButtonElement, {
  label: string;
  shortcut?: string;
  active?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">>(
  function HeaderIconButton({ label, shortcut, active, children, className = "", ...rest }, ref) {
    return (
      <Tooltip label={label} shortcut={shortcut}>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={`relative w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-control"
          } ${className}`}
          {...rest}
        >
          {children}
        </button>
      </Tooltip>
    );
  },
);

/** The page's create action: the one filled button in the header. */
export function CreateButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Tooltip label={label} shortcut="C">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SquarePen size={15} strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}
