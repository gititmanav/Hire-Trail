/**
 * Sticky filter/toolbar row above the Applications list. Search input, stage
 * filter chips with counts, and view controls (density, group toggle).
 */
import { memo, useEffect, useRef } from "react";
import { Search, Group, Rows3, Rows4 } from "lucide-react";
import type { Stage } from "../../../types";
import type { Density, StageFilter } from "../../../hooks/useApplicationsListState.ts";
import {
  STAGES,
  STAGE_FILTER_ACTIVE_CLASS,
  STAGE_FILTER_COUNT_CLASS,
} from "../../../utils/stageStyles.ts";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  stageFilter: StageFilter;
  onStageFilter: (s: StageFilter) => void;
  stageCounts: Record<Stage, number>;
  density: Density;
  onDensity: (d: Density) => void;
  groupByCompany: boolean;
  onGroupToggle: (v: boolean) => void;
  onShortcutsHelp: () => void;
  /** When the global `/` shortcut fires, parent calls this to focus the search input. */
  focusSearchRef: React.MutableRefObject<(() => void) | null>;
}

function ApplicationsToolbarImpl({
  search, onSearch,
  stageFilter, onStageFilter,
  stageCounts,
  density, onDensity,
  groupByCompany, onGroupToggle,
  onShortcutsHelp,
  focusSearchRef,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusSearchRef.current = () => inputRef.current?.focus();
    return () => { focusSearchRef.current = null; };
  }, [focusSearchRef]);

  return (
    <div className="sticky top-[49px] z-20 bg-background/95 backdrop-blur-sm py-3 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-border/40">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[300px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            className="input-premium w-full !pl-9"
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search applications"
          />
          <kbd className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 text-[10px] font-mono rounded border border-border bg-muted text-muted-foreground pointer-events-none">/</kbd>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Stage filter">
          <button
            onClick={() => onStageFilter("All")}
            role="tab"
            aria-selected={stageFilter === "All"}
            className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border ${
              stageFilter === "All"
                ? "bg-muted border-border text-foreground"
                : "bg-card border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
            }`}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => onStageFilter(s)}
              role="tab"
              aria-selected={stageFilter === s}
              className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border ${
                stageFilter === s
                  ? `${STAGE_FILTER_ACTIVE_CLASS[s]} shadow-sm`
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {s}
              <span
                className={`text-[11px] px-1.5 rounded-full ${
                  stageFilter === s ? STAGE_FILTER_COUNT_CLASS[s] : "bg-muted text-muted-foreground"
                }`}
              >
                {stageCounts[s] || 0}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => onGroupToggle(!groupByCompany)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md border ${
              groupByCompany
                ? "bg-muted border-border text-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            }`}
            aria-pressed={groupByCompany}
            title="Group rows by company"
          >
            <Group size={12} strokeWidth={1.8} aria-hidden />
            Group
          </button>

          <div className="inline-flex items-center rounded-md border border-border bg-card overflow-hidden" role="group" aria-label="Density">
            <button
              onClick={() => onDensity("comfortable")}
              className={`px-2 py-1 text-[12px] ${density === "comfortable" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={density === "comfortable"}
              title="Comfortable density"
            >
              <Rows3 size={14} strokeWidth={1.8} aria-hidden />
            </button>
            <button
              onClick={() => onDensity("compact")}
              className={`px-2 py-1 text-[12px] ${density === "compact" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={density === "compact"}
              title="Compact density"
            >
              <Rows4 size={14} strokeWidth={1.8} aria-hidden />
            </button>
          </div>

          <button
            onClick={onShortcutsHelp}
            className="w-7 h-7 inline-flex items-center justify-center text-[12px] font-mono rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ApplicationsToolbarImpl);
