/** The Filters panel in the Applications header (ui/FiltersPopover): every
 *  filter, the current view's display options, export, and the
 *  keyboard-shortcuts help. */
import { ReactNode } from "react";
import { Building2, Download, FileText, Keyboard, Mail, PenLine, Puzzle } from "lucide-react";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import FiltersPopover, { ANY_DOT, FilterRow as Row, FiltersFooterButton } from "../../../components/ui/FiltersPopover.tsx";
import Select, { type SelectOption } from "../../../components/ui/Select.tsx";
import SegmentedControl from "../../../components/ui/SegmentedControl.tsx";
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

const stageDot = (s: string) => <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[s as keyof typeof STAGE_STRIPE_CLASS]}`} />;

export default function FiltersMenu({
  open, onOpenChange, filters, setFilters, onReset, canReset,
  tabCounts, stageCounts, showStage, options, resumes, display, onExport, onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ApplicationFilters;
  setFilters: (patch: Partial<ApplicationFilters>) => void;
  /** Reset everything the panel holds: every filter and this view's display options. */
  onReset: () => void;
  canReset: boolean;
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
    <FiltersPopover
      open={open}
      onOpenChange={onOpenChange}
      active={active}
      onReset={onReset}
      canReset={canReset}
      display={display}
      filters={
        <>
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
        </>
      }
      footer={
        <>
          <FiltersFooterButton icon={<Keyboard size={14} strokeWidth={1.8} aria-hidden />} onClick={() => { onOpenChange(false); onShortcuts(); }}>
            Keyboard shortcuts
          </FiltersFooterButton>
          {onExport && (
            <FiltersFooterButton icon={<Download size={14} strokeWidth={1.8} aria-hidden />} onClick={() => { onOpenChange(false); onExport(); }}>
              Export CSV
            </FiltersFooterButton>
          )}
        </>
      }
    />
  );
}
