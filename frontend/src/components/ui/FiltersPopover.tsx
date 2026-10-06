/** The Filters button and panel every page header uses ("f"): the page's
 *  filters, its display options, and a footer for page tools (export,
 *  shortcuts). One place for all of it — nothing filter-shaped lives out in
 *  the open on a page. Applications' FiltersMenu, Contacts, Companies,
 *  Resumes and the Dashboard all compose it. */
import { ReactNode, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import Popover, { PopoverDivider, PopoverLabel, PopoverSection } from "./Popover.tsx";
import Tooltip from "./Tooltip.tsx";

/** One settings row: label left, its control right (Sora-style). */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-9 px-2.5">
      <span className="text-[13px] text-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

/** The "any" option's mark: a hollow ring where the others have a colour. */
export const ANY_DOT = <span className="w-2 h-2 rounded-full border border-muted-foreground/60" />;

/** A quiet text button for the panel's footer row. */
export function FiltersFooterButton({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
      {icon}
      {children}
    </button>
  );
}

export default function FiltersPopover({
  open, onOpenChange, active, onReset, canReset, filters, display, footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many filters narrow the page (the button's badge). */
  active: number;
  /** Reset everything the panel holds — filters and display options. */
  onReset: () => void;
  canReset: boolean;
  /** FilterRows. */
  filters?: ReactNode;
  /** FilterRows for how the page shows its records. */
  display?: ReactNode;
  /** Page tools (FiltersFooterButtons), in a row at the bottom. */
  footer?: ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const reset = (
    <button
      type="button"
      onClick={onReset}
      disabled={!canReset}
      className="text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
    >
      Reset
    </button>
  );

  return (
    <>
      <Tooltip label={filters ? "Filters and display" : "Display options"} shortcut="F">
        <button
          ref={anchorRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={active ? `Filters (${active} active)` : filters ? "Filters" : "Display options"}
          aria-expanded={open}
          className={`relative w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active || open ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-control"
          }`}
        >
          <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden />
          {active > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-4 text-center tabular-nums">
              {active}
            </span>
          )}
        </button>
      </Tooltip>

      <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} align="end" width={340} ariaLabel={filters ? "Filters and display" : "Display options"}>
        {filters && (
          <PopoverSection>
            <PopoverLabel action={reset}>Filters</PopoverLabel>
            {filters}
          </PopoverSection>
        )}
        {display && (
          <>
            {filters && <PopoverDivider />}
            <PopoverSection>
              <PopoverLabel action={filters ? undefined : reset}>Display options</PopoverLabel>
              {display}
            </PopoverSection>
          </>
        )}
        {footer && (
          <>
            <PopoverDivider />
            <PopoverSection className="flex items-center justify-between">{footer}</PopoverSection>
          </>
        )}
      </Popover>
    </>
  );
}
