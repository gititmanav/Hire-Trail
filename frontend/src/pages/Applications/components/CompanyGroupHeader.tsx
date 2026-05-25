/** Collapsible parent row for multi-role-at-same-company grouping. */
import StageChip from "../../../components/StageChip/StageChip.tsx";
import type { Application } from "../../../types";

interface Props {
  company: string;
  apps: Application[];
  expanded: boolean;
  onToggle: () => void;
}

export default function CompanyGroupHeader({ company, apps, expanded, onToggle }: Props) {
  const uniqueStages = Array.from(new Set(apps.map((a) => a.stage)));
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted text-left transition-colors"
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        aria-hidden
      >
        <path d="M9 6l6 6-6 6"/>
      </svg>
      <span className="text-[13px] font-semibold text-foreground">{company}</span>
      <span className="text-[11px] text-muted-foreground font-medium">
        {apps.length} role{apps.length === 1 ? "" : "s"}
      </span>
      <div className="ml-auto flex gap-1">
        {uniqueStages.map((s) => (
          <StageChip key={s} stage={s} size="sm" />
        ))}
      </div>
    </button>
  );
}
