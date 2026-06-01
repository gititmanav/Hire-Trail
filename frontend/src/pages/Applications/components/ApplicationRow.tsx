/**
 * One full-width application row. Composed of:
 *   - 3px stage-tone edge strip (the row's only urgency cue — replaces the
 *     previous "bright blue button on some rows, ghost on others" rhythm bug)
 *   - left rail: hover-reveal checkbox + CompanyLogo (Clearbit/Cloudinary
 *     cached, monogram fallback)
 *   - middle content: role (dominant), company (secondary), chip strip,
 *     stage-aware age badge
 *   - right "Pipeline Pulse" panel: stage track + health + next-action link
 *
 * On <sm the right panel reflows below content as a footer strip.
 */
import { memo, useMemo } from "react";
import {
  Pencil, Trash2, ExternalLink, Mail, MapPin, DollarSign, FileText, User as UserIcon, Clock,
} from "lucide-react";
import PipelinePulse from "./PipelinePulse.tsx";
import AppFieldGrid from "./AppFieldGrid.tsx";
import AppFitPanel from "./AppFitPanel.tsx";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import {
  computeAppHealth,
  HEALTH_BADGE_CLASS,
  suggestNextAction,
} from "../../../utils/applicationHealth.ts";
import { STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import type { Application, Company, Contact, Deadline, Resume } from "../../../types";

interface Props {
  app: Application;
  company?: Company;
  resume?: Resume;
  contact?: Contact;
  deadlines: Deadline[];
  density: "comfortable" | "compact";
  focused?: boolean;
  selected: boolean;
  selectionActive: boolean;
  /** 0-based index within the visible list, used to stagger the entrance
   *  animation on filter changes. -1 disables the stagger (useful for
   *  groups / replays). */
  staggerIndex?: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
  onResumeClick?: () => void;
  /** Opens the AI fit sidebar for the given session (or null if none yet). */
  onOpenFit?: (sessionId: string | null) => void;
  /** Triggers a (re)run of fit analysis for this application. */
  onRunFit?: () => void;
  /** Whether the signed-in user has finished setting up their master profile.
   *  Threaded through to AppFitPanel so the empty-state copy is honest. */
  hasMasterProfile?: boolean;
}


function Chip({
  children,
  title,
  tone = "default",
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "default" | "warn" | "info";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      : tone === "info"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      : "bg-muted text-secondary-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${toneClass} max-w-[200px]`}
      title={title}
    >
      {children}
    </span>
  );
}

const DAY_MS = 86_400_000;

function ApplicationRowImpl({
  app, company, resume, contact, deadlines,
  density, focused, selected, selectionActive, staggerIndex = -1,
  onOpen, onEdit, onDelete, onToggleSelect, onResumeClick, onOpenFit, onRunFit,
  hasMasterProfile = true,
}: Props) {
  // Cap stagger to first ~12 rows so a long list doesn't take seconds to materialize.
  const staggerDelay = staggerIndex >= 0 ? Math.min(staggerIndex, 11) * 25 : undefined;
  const health = useMemo(() => computeAppHealth(app), [app]);
  const action = useMemo(
    () => suggestNextAction(app, { deadlines, contact }),
    [app, deadlines, contact]
  );

  const upcomingDeadline = useMemo(() => {
    const now = Date.now();
    const list = deadlines
      .filter((d) => d.applicationId === app._id && !d.completed)
      .map((d) => ({ ...d, due: new Date(d.dueDate).getTime() }))
      .filter((d) => !isNaN(d.due));
    list.sort((a, b) => a.due - b.due);
    const next = list[0];
    if (!next) return null;
    const dueIn = Math.round((next.due - now) / DAY_MS);
    return { type: next.type, dueIn };
  }, [deadlines, app._id]);

  const isCompact = density === "compact";

  // Edge stripe — strictly mirrors the current stage so the card's left
  // edge IS the stage indicator. Color updates automatically when app.stage
  // changes (parent passes a new app object on stage transitions, memo
  // invalidates). Stale/urgent state is conveyed via HEALTH_BADGE_CLASS
  // on the age badge to the right, not by hijacking the stage stripe.
  const edgeClass = STAGE_STRIPE_CLASS[app.stage];

  return (
    <div
      role="listitem"
      tabIndex={focused ? 0 : -1}
      data-app-row="1"
      data-app-id={app._id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input")) return;
        onOpen();
      }}
      style={staggerDelay !== undefined ? { animationDelay: `${staggerDelay}ms` } : undefined}
      className={`group relative flex flex-col sm:flex-row items-stretch overflow-hidden rounded-xl border bg-card transition-shadow cursor-pointer hover:shadow-sm ${
        staggerIndex >= 0 ? "app-row-stagger" : ""
      } ${
        selected
          ? "border-primary ring-2 ring-primary/30"
          : focused
          ? "border-muted-foreground/40"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      {/* Edge stripe — the row's only urgency cue */}
      <div
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${edgeClass}`}
      />

      {/* Left rail: bare logo pinned top-left of the card. The selection
       *  checkbox sits BELOW the logo (centred under it) so the brand mark
       *  occupies the corner cleanly. Checkbox is still hover-revealed unless
       *  a selection is already active. */}
      <div className={`flex flex-col items-center gap-1.5 pl-3 pr-2 sm:pr-3 ${isCompact ? "py-2" : "py-3"}`}>
        <CompanyLogo
          name={app.company}
          logoUrl={company?.logoUrl}
          size={isCompact ? "md" : "lg"}
          bare
        />
        <label
          className={`inline-flex w-5 h-5 items-center justify-center rounded transition-opacity ${
            selectionActive || selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${app.company} ${app.role}`}
            className="h-4 w-4 accent-primary cursor-pointer"
          />
        </label>
      </div>

      {/* Middle: content */}
      <div className={`flex-1 min-w-0 ${isCompact ? "py-2 pr-3" : "py-3 pr-3"} flex flex-col gap-1.5`}>
        <div className="flex items-start gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className={`${isCompact ? "text-[14px]" : "text-[15px]"} font-bold text-foreground truncate tracking-tight`}>
                {app.role}
              </h3>
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/60 hover:text-foreground shrink-0"
                  aria-label="Open job posting"
                >
                  <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              )}
              {app.emailImport ? (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  title="Imported from a Gmail inbox-scan candidate"
                >
                  <Mail size={10} strokeWidth={2} aria-hidden />
                  From email
                </span>
              ) : app.source && app.source !== "manual" && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  title={`Captured via ${app.source}`}
                >
                  via {app.source}
                </span>
              )}
            </div>
            <p className={`text-[12px] text-muted-foreground truncate font-medium`}>
              {app.company}
            </p>
          </div>

          {/* Age badge — pinned to the top-right of the content block */}
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ring-1 ring-inset tabular-nums ${HEALTH_BADGE_CLASS[health.tone]}`}
            title={health.longLabel}
            aria-label={health.longLabel}
          >
            {health.shortLabel}
          </span>
        </div>

        {/* Detail strip: comfortable mode shows the always-on icon grid;
         *  compact mode keeps the wrap-chip layout to preserve row height. */}
        {isCompact ? (
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {app.location && (
              <Chip title={app.location}>
                <MapPin size={10} strokeWidth={2} aria-hidden />
                <span className="truncate">{app.location}</span>
              </Chip>
            )}
            {app.salary && (
              <Chip title={app.salary}>
                <DollarSign size={10} strokeWidth={2} aria-hidden />
                <span className="truncate">{app.salary}</span>
              </Chip>
            )}
            {app.jobType && <Chip title={app.jobType}><span className="truncate">{app.jobType}</span></Chip>}
            {resume && (
              <Chip title={`Resume: ${resume.name}`}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResumeClick?.(); }}
                  className="inline-flex items-center gap-1 truncate"
                  aria-label={`View resume ${resume.name}`}
                >
                  <FileText size={10} strokeWidth={1.5} aria-hidden />
                  <span className="truncate">{resume.name}</span>
                </button>
              </Chip>
            )}
            {contact && (
              <Chip title={`Contact: ${contact.name}`} tone="info">
                <UserIcon size={10} strokeWidth={1.5} aria-hidden />
                <span className="truncate">{contact.name}</span>
              </Chip>
            )}
            {upcomingDeadline && (
              <Chip
                title={`${upcomingDeadline.type} in ${upcomingDeadline.dueIn} day${upcomingDeadline.dueIn === 1 ? "" : "s"}`}
                tone={upcomingDeadline.dueIn <= 3 ? "warn" : "info"}
              >
                <Clock size={10} strokeWidth={1.5} aria-hidden />
                <span className="truncate">
                  {upcomingDeadline.type} · {upcomingDeadline.dueIn <= 0 ? "today" : `${upcomingDeadline.dueIn}d`}
                </span>
              </Chip>
            )}
          </div>
        ) : (
          <AppFieldGrid app={app} resume={resume} contact={contact} deadlines={deadlines} />
        )}

        {/* Notes preview — only in comfortable density */}
        {!isCompact && app.notes && (
          <p className="text-[12px] text-muted-foreground line-clamp-1 mt-1">{app.notes}</p>
        )}
      </div>

      {/* Hover action buttons */}
      <div className="hidden sm:flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
          title="Edit"
          aria-label="Edit application"
        >
          <Pencil size={13} strokeWidth={1.6} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-danger hover:border-danger"
          title="Delete"
          aria-label="Delete application"
        >
          <Trash2 size={13} strokeWidth={1.6} aria-hidden />
        </button>
      </div>

      {/* Right: Pipeline Pulse */}
      <PipelinePulse app={app} health={health} action={action} onOpen={onOpen} />
      <AppFitPanel
        fit={app.fit}
        onOpen={(sid) => onOpenFit?.(sid)}
        onRun={onRunFit}
        hasMasterProfile={hasMasterProfile}
        hasJobDescription={!!app.jobDescription?.trim()}
        extracting={app.aiExtractionStatus === "processing"}
      />
    </div>
  );
}

export default memo(ApplicationRowImpl);
