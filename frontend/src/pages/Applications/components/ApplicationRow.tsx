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
  onOpen, onEdit, onDelete, onToggleSelect, onResumeClick, onOpenFit,
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
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 6.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h3"/><polyline points="7,1.5 10.5,1.5 10.5,5"/><line x1="5.5" y1="6.5" x2="10.5" y2="1.5"/></svg>
                </a>
              )}
              {app.emailImport ? (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  title="Imported from a Gmail inbox-scan candidate"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="truncate">{app.location}</span>
              </Chip>
            )}
            {app.salary && (
              <Chip title={app.salary}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>
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
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>
                  <span className="truncate">{resume.name}</span>
                </button>
              </Chip>
            )}
            {contact && (
              <Chip title={`Contact: ${contact.name}`} tone="info">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span className="truncate">{contact.name}</span>
              </Chip>
            )}
            {upcomingDeadline && (
              <Chip
                title={`${upcomingDeadline.type} in ${upcomingDeadline.dueIn} day${upcomingDeadline.dueIn === 1 ? "" : "s"}`}
                tone={upcomingDeadline.dueIn <= 3 ? "warn" : "info"}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
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
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-danger hover:border-danger"
          title="Delete"
          aria-label="Delete application"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg>
        </button>
      </div>

      {/* Right: Pipeline Pulse */}
      <PipelinePulse app={app} health={health} action={action} onOpen={onOpen} />
      <AppFitPanel fit={app.fit} onOpen={(sid) => onOpenFit?.(sid)} />
    </div>
  );
}

export default memo(ApplicationRowImpl);
