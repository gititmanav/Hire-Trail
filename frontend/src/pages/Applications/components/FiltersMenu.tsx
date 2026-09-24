/** The Filters panel in the Applications header: every filter, the current
 *  view's display options, export, and the keyboard-shortcuts help. One place
 *  for all of it — nothing filter-shaped lives out in the open on the page. */
import { ReactNode, useRef } from "react";
import { Download, Keyboard, SlidersHorizontal } from "lucide-react";
import Popover from "../../../components/ui/Popover.tsx";
import Select from "../../../components/ui/Select.tsx";
import SegmentedControl from "../../../components/ui/SegmentedControl.tsx";
import Tooltip from "../../../components/ui/Tooltip.tsx";
import { STAGES } from "../../../utils/stageStyles.ts";
import { activeFilterCount, type ApplicationFilters, type AppStatus } from "../data/filters.ts";
import type { ApplicationFilterOptions } from "../../../utils/api.ts";
import type { Resume } from "../../../types";

const SOURCE_LABEL: Record<string, string> = { manual: "Added manually", extension: "Browser extension", email: "Inbox scan" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[72px] shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      {action}
    </div>
  );
}

export { Row as FilterRow };

export default function FiltersMenu({
  open, onOpenChange, filters, setFilters, resetFilters,
  tabCounts, stageCounts, showStage, options, resumes, display, onExport, onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ApplicationFilters;
  setFilters: (patch: Partial<ApplicationFilters>) => void;
  resetFilters: () => void;
  tabCounts?: { active: number; archived: number };
  /** Counts per stage for the current filters (shown in the stage options). */
  stageCounts?: Record<string, number>;
  /** Board columns ARE the stages, so the stage filter hides there. */
  showStage: boolean;
  options?: ApplicationFilterOptions;
  resumes: Resume[];
  /** The current view's display options. */
  display?: ReactNode;
  onExport?: () => void;
  onShortcuts: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const active = activeFilterCount({ ...filters, stage: showStage ? filters.stage : "" });

  const resumeName = (id: string) => resumes.find((r) => r._id === id)?.name ?? "Untitled resume";
  const resumeOptions = [
    { value: "", label: "Any resume" },
    ...(options?.hasUnassignedResume ? [{ value: "none", label: "No resume attached" }] : []),
    ...(options?.resumeIds ?? []).map((id) => ({ value: id, label: resumeName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
  ];
  // A filter pointing at a value no longer in the data (stale link) still
  // shows, so the user can see — and clear — what's narrowing the view.
  if (filters.resume && !resumeOptions.some((o) => o.value === filters.resume)) {
    resumeOptions.push({ value: filters.resume, label: resumeName(filters.resume) });
  }
  const companyOptions = [{ value: "", label: "Any company" }, ...(options?.companies ?? []).map((c) => ({ value: c, label: c }))];
  if (filters.company && !companyOptions.some((o) => o.value === filters.company)) {
    companyOptions.push({ value: filters.company, label: filters.company });
  }

  return (
    <>
      <Tooltip label="Filters and display" shortcut="F">
        <button
          ref={anchorRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={active ? `Filters (${active} active)` : "Filters"}
          aria-expanded={open}
          className={`relative w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active || open ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
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

      <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} align="end" width={344} ariaLabel="Filters and display">
        <div className="p-4 space-y-4">
          <section>
            <SectionLabel
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={active === 0}
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                >
                  Reset
                </button>
              }
            >
              Filters
            </SectionLabel>
            <div className="space-y-2.5">
              <Row label="Status">
                <SegmentedControl<AppStatus>
                  ariaLabel="Status"
                  size="sm"
                  value={filters.status}
                  onChange={(status) => setFilters({ status })}
                  segments={[
                    { value: "active", label: "Active", count: tabCounts?.active },
                    { value: "archived", label: "Archived", count: tabCounts?.archived },
                  ]}
                />
              </Row>
              {showStage && (
                <Row label="Stage">
                  <Select
                    size="sm"
                    ariaLabel="Stage"
                    value={filters.stage}
                    onChange={(v) => setFilters({ stage: v as ApplicationFilters["stage"] })}
                    options={[
                      { value: "", label: "Any stage" },
                      ...STAGES.map((s) => ({ value: s, label: stageCounts ? `${s} · ${stageCounts[s] ?? 0}` : s })),
                    ]}
                  />
                </Row>
              )}
              <Row label="Company">
                <Select size="sm" ariaLabel="Company" searchable searchPlaceholder="Search companies…" value={filters.company} onChange={(company) => setFilters({ company })} options={companyOptions} />
              </Row>
              <Row label="Resume">
                <Select size="sm" ariaLabel="Resume" searchable={resumeOptions.length > 8} searchPlaceholder="Search resumes…" value={filters.resume} onChange={(resume) => setFilters({ resume })} options={resumeOptions} />
              </Row>
              <Row label="Source">
                <Select
                  size="sm"
                  ariaLabel="Source"
                  value={filters.source}
                  onChange={(source) => setFilters({ source })}
                  options={[{ value: "", label: "Any source" }, ...["manual", "extension", "email"].map((s) => ({ value: s, label: SOURCE_LABEL[s] }))]}
                />
              </Row>
            </div>
          </section>

          {display && (
            <section className="pt-4 border-t border-border">
              <SectionLabel>Display</SectionLabel>
              <div className="space-y-2.5">{display}</div>
            </section>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => { onOpenChange(false); onShortcuts(); }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
            >
              <Keyboard size={14} strokeWidth={1.8} aria-hidden />
              Keyboard shortcuts
            </button>
            {onExport && (
              <button
                type="button"
                onClick={() => { onOpenChange(false); onExport(); }}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
              >
                <Download size={14} strokeWidth={1.8} aria-hidden />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}
