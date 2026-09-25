/** The Filters panel in the Applications header: every filter, the current
 *  view's display options, export, and the keyboard-shortcuts help. One place
 *  for all of it — nothing filter-shaped lives out in the open on the page. */
import { ReactNode, useRef } from "react";
import { Building2, Download, FileText, Keyboard, Mail, PenLine, Puzzle, SlidersHorizontal } from "lucide-react";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import Popover, { PopoverDivider, PopoverLabel, PopoverSection } from "../../../components/ui/Popover.tsx";
import Select, { type SelectOption } from "../../../components/ui/Select.tsx";
import SegmentedControl from "../../../components/ui/SegmentedControl.tsx";
import Tooltip from "../../../components/ui/Tooltip.tsx";
import { STAGES, STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { activeFilterCount, type ApplicationFilters, type AppStatus } from "../data/filters.ts";
import { useCompanies } from "../data/queries.ts";
import type { ApplicationFilterOptions } from "../../../utils/api.ts";
import type { Resume } from "../../../types";

const SOURCE_LABEL: Record<string, string> = { manual: "Added manually", extension: "Browser extension", email: "Inbox scan" };
const SOURCE_ICON: Record<string, React.ReactNode> = {
  manual: <PenLine size={14} strokeWidth={1.8} className="text-muted-foreground" />,
  extension: <Puzzle size={14} strokeWidth={1.8} className="text-muted-foreground" />,
  email: <Mail size={14} strokeWidth={1.8} className="text-muted-foreground" />,
};

/** The "any" option's mark: a hollow ring where the others have a colour. */
const ANY_DOT = <span className="w-2 h-2 rounded-full border border-muted-foreground/60" />;
const stageDot = (s: string) => <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[s as keyof typeof STAGE_STRIPE_CLASS]}`} />;

/** One settings row: label left, its control right (Sora-style). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-9 px-2.5">
      <span className="text-[13px] text-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex justify-end">{children}</div>
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

  const { data: companies = [] } = useCompanies();
  const logoByName = new Map(companies.map((c) => [c.name.toLowerCase(), c.logoUrl]));
  const companyMark = (name: string) => <CompanyLogo name={name} logoUrl={logoByName.get(name.toLowerCase())} size="2xs" />;
  const resumeIcon = <FileText size={14} strokeWidth={1.8} className="text-muted-foreground" />;

  const resumeName = (id: string) => resumes.find((r) => r._id === id)?.name ?? "Untitled resume";
  const resumeOptions: SelectOption[] = [
    { value: "", label: "Any resume", icon: resumeIcon },
    ...(options?.hasUnassignedResume ? [{ value: "none", label: "No resume attached", icon: resumeIcon }] : []),
    ...(options?.resumeIds ?? []).map((id) => ({ value: id, label: resumeName(id), icon: resumeIcon })).sort((a, b) => a.label.localeCompare(b.label)),
  ];
  // A filter pointing at a value no longer in the data (stale link) still
  // shows, so the user can see — and clear — what's narrowing the view.
  if (filters.resume && !resumeOptions.some((o) => o.value === filters.resume)) {
    resumeOptions.push({ value: filters.resume, label: resumeName(filters.resume), icon: resumeIcon });
  }
  const companyOptions: SelectOption[] = [
    { value: "", label: "Any company", icon: <Building2 size={14} strokeWidth={1.8} className="text-muted-foreground" /> },
    ...(options?.companies ?? []).map((c) => ({ value: c, label: c, icon: companyMark(c) })),
  ];
  if (filters.company && !companyOptions.some((o) => o.value === filters.company)) {
    companyOptions.push({ value: filters.company, label: filters.company, icon: companyMark(filters.company) });
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

      <Popover open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} align="end" width={340} ariaLabel="Filters and display">
        <PopoverSection>
          <PopoverLabel
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
          </PopoverLabel>
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
                variant="pill"
                ariaLabel="Stage"
                value={filters.stage}
                onChange={(v) => setFilters({ stage: v as ApplicationFilters["stage"] })}
                options={[
                  { value: "", label: "Any stage", icon: ANY_DOT },
                  ...STAGES.map((s) => ({ value: s, label: stageCounts ? `${s} · ${stageCounts[s] ?? 0}` : s, icon: stageDot(s) })),
                ]}
              />
            </Row>
          )}
          <Row label="Company">
            <Select variant="pill" ariaLabel="Company" searchable searchPlaceholder="Search companies…" value={filters.company} onChange={(company) => setFilters({ company })} options={companyOptions} />
          </Row>
          <Row label="Resume">
            <Select variant="pill" ariaLabel="Resume" searchable={resumeOptions.length > 8} searchPlaceholder="Search resumes…" value={filters.resume} onChange={(resume) => setFilters({ resume })} options={resumeOptions} />
          </Row>
          <Row label="Source">
            <Select
              variant="pill"
              ariaLabel="Source"
              value={filters.source}
              onChange={(source) => setFilters({ source })}
              options={[
                { value: "", label: "Any source", icon: ANY_DOT },
                ...["manual", "extension", "email"].map((s) => ({ value: s, label: SOURCE_LABEL[s], icon: SOURCE_ICON[s] })),
              ]}
            />
          </Row>
        </PopoverSection>

        {display && (
          <>
            <PopoverDivider />
            <PopoverSection>
              <PopoverLabel>Display options</PopoverLabel>
              {display}
            </PopoverSection>
          </>
        )}

        <PopoverDivider />
        <PopoverSection className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { onOpenChange(false); onShortcuts(); }}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <Keyboard size={14} strokeWidth={1.8} aria-hidden />
            Keyboard shortcuts
          </button>
          {onExport && (
            <button
              type="button"
              onClick={() => { onOpenChange(false); onExport(); }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              <Download size={14} strokeWidth={1.8} aria-hidden />
              Export CSV
            </button>
          )}
        </PopoverSection>
      </Popover>
    </>
  );
}
