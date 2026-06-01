/** Toolbar-anchored popover housing Show / Company / Stage filters. */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import { STAGES, STAGE_CALENDAR_HEX } from "../../../utils/stageStyles.ts";
import type { CalendarFactor } from "../../../utils/calendarEvents.ts";
import type { Stage } from "../../../types";

interface FactorOption {
  key: CalendarFactor;
  label: string;
  swatch: string;
}

interface Props {
  factors: Record<CalendarFactor, boolean>;
  setFactors: (next: Record<CalendarFactor, boolean>) => void;
  companyFilter: string;
  setCompanyFilter: (next: string) => void;
  stageFilter: Record<Stage, boolean>;
  setStageFilter: (next: Record<Stage, boolean>) => void;
  companyNames: string[];
  factorOptions: FactorOption[];
  /** Default factor + stage records used to compute the "filters modified" indicator. */
  defaultFactors: Record<CalendarFactor, boolean>;
  defaultStageFilter: Record<Stage, boolean>;
  onReset: () => void;
}

export function FiltersPopover(props: Props) {
  const {
    factors, setFactors,
    companyFilter, setCompanyFilter,
    stageFilter, setStageFilter,
    companyNames, factorOptions,
    defaultFactors, defaultStageFilter,
    onReset,
  } = props;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // "Modified" count for the badge — number of toggles flipped from default OR a company filter.
  const modifiedCount =
    (Object.keys(factors) as CalendarFactor[]).filter((k) => factors[k] !== defaultFactors[k]).length +
    (Object.keys(stageFilter) as Stage[]).filter((k) => stageFilter[k] !== defaultStageFilter[k]).length +
    (companyFilter ? 1 : 0);

  return (
    <div className="filters-pop" ref={wrapRef}>
      <button
        type="button"
        className={`cal-toolbar__filters ${open ? "cal-toolbar__filters--open" : ""} ${modifiedCount > 0 ? "cal-toolbar__filters--modified" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Filters"
      >
        <Filter size={14} strokeWidth={2} />
        <span>Filters</span>
        {modifiedCount > 0 && <span className="cal-toolbar__filters-badge">{modifiedCount}</span>}
      </button>

      {open && (
        <div className="filters-pop__panel" role="dialog" aria-label="Filters">
          <div className="filters-pop__head">
            <h4>Filters</h4>
            {modifiedCount > 0 && (
              <button type="button" className="filters-pop__reset" onClick={onReset}>
                Reset
              </button>
            )}
          </div>

          <div className="filters-pop__group">
            <span className="filters-pop__label">Show</span>
            <div className="filters-pop__legend">
              {factorOptions.map((o) => (
                <label key={o.key} className={`cal-legend-item ${factors[o.key] ? "" : "cal-legend-item--off"}`}>
                  <input
                    type="checkbox"
                    checked={factors[o.key]}
                    onChange={() => setFactors({ ...factors, [o.key]: !factors[o.key] })}
                  />
                  <span className="cal-legend-dot" style={{ background: o.swatch }} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filters-pop__group">
            <span className="filters-pop__label">Company</span>
            <ActionDropdown
              align="left"
              menuWidth="w-full"
              searchable
              searchPlaceholder="Search company…"
              maxVisibleItems={7}
              trigger={
                <button type="button" className="cal-filters__select cal-filters__select--trigger">
                  <span className="truncate">{companyFilter || "All companies"}</span>
                  <ChevronDown size={12} strokeWidth={1.6} />
                </button>
              }
              items={[
                {
                  label: "All companies",
                  onClick: () => setCompanyFilter(""),
                  className: !companyFilter ? "text-primary font-medium" : undefined,
                },
                ...companyNames.map((n) => ({
                  label: n,
                  onClick: () => setCompanyFilter(n),
                  className: companyFilter === n ? "text-primary font-medium" : undefined,
                })),
              ]}
            />
          </div>

          <div className="filters-pop__group">
            <span className="filters-pop__label">Stage</span>
            <div className="cal-filters__chips">
              {STAGES.map((stage) => {
                const on = stageFilter[stage];
                const c = STAGE_CALENDAR_HEX[stage];
                const style = on ? {
                  ["--chip-bg" as string]: c.backgroundColor,
                  ["--chip-border" as string]: c.borderColor,
                } : undefined;
                return (
                  <label key={stage} className={`cal-stage-chip ${on ? "cal-stage-chip--on" : ""}`} style={style}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setStageFilter({ ...stageFilter, [stage]: !on })}
                    />
                    <span className="cal-stage-chip__dot" style={{ background: c.backgroundColor }} />
                    <span>{stage}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
