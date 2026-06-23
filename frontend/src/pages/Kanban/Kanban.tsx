/**
 * Stage columns with @dnd-kit drag/drop; stage updates persist via applications API.
 */
import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { applicationsAPI, resumesAPI } from "../../utils/api.ts";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import type { DropdownItem } from "../../components/ActionDropdown/ActionDropdown.tsx";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import { computeAppHealth, HEALTH_DOT_CLASS } from "../../utils/applicationHealth.ts";
import { STAGE_STRIPE_CLASS } from "../../utils/stageStyles.ts";
import { MapPin, FileText, AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { dwellAverages, currentStageDwell } from "../../utils/stageStats.ts";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { useDeadlineFollowups } from "../../hooks/useDeadlineFollowups.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import type { Application, Resume, Stage } from "../../types";

const STAGES: Stage[] = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"];

/** Card density. Persisted to localStorage so the user's pick survives reloads.
 *  - mini:     company + stage dot + age. One line, scan-only.
 *  - regular:  default — company, role, location/resume chips, date, CTA.
 *  - detailed: regular + salary, job type, contact monogram. Maximum context. */
export type KanbanDensity = "mini" | "regular" | "detailed";
const DENSITY_KEY = "hiretrail-kanban-density";
function readDensity(): KanbanDensity {
  if (typeof window === "undefined") return "regular";
  try {
    const v = window.localStorage.getItem(DENSITY_KEY);
    return v === "mini" || v === "detailed" ? v : "regular";
  } catch {
    return "regular";
  }
}
const CFG: Record<Stage, { dot: string; hBg: string; border: string; bg: string }> = {
  Drafting: { dot: "bg-slate-400", hBg: "bg-slate-50 dark:bg-slate-800/30", border: "border-slate-200/60 dark:border-slate-700/50", bg: "bg-slate-50/40 dark:bg-slate-900/20" },
  Applied: { dot: "bg-blue-500", hBg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40", bg: "bg-blue-50/30 dark:bg-blue-950/20" },
  OA: { dot: "bg-warning", hBg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40", bg: "bg-amber-50/30 dark:bg-amber-950/20" },
  Interview: { dot: "bg-purple-500", hBg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200/60 dark:border-purple-800/40", bg: "bg-purple-50/30 dark:bg-purple-950/20" },
  Offer: { dot: "bg-success", hBg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40", bg: "bg-emerald-50/30 dark:bg-emerald-950/20" },
  Rejected: { dot: "bg-danger", hBg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200/60 dark:border-red-800/40", bg: "bg-red-50/30 dark:bg-red-950/20" },
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const KanbanCard = memo(function KanbanCard({ app, resumeName, isDragging, density = "regular" }: { app: Application; resumeName?: string; isDragging?: boolean; density?: KanbanDensity }) {
  const navigate = useNavigate();
  const isDrafting = app.stage === "Drafting" && !!app.tailorSessionId;
  const health = useMemo(() => computeAppHealth(app), [app]);

  // Mini: single line — company · age. Built for visual scanning of stuck
  // columns. Role/CTAs/chips all suppressed.
  if (density === "mini") {
    return (
      <div
        className={`card-premium px-2.5 py-1.5 min-w-0 overflow-hidden flex items-center gap-2 ${isDragging ? "!shadow-lg ring-2 ring-ring/20 scale-[1.02]" : ""}`}
        title={`${app.role} · ${app.company}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[health.tone]} shrink-0`} aria-hidden />
        <span className="text-[12px] font-medium text-foreground truncate min-w-0 flex-1">{app.company}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{health.shortLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={`card-premium p-3 min-w-0 overflow-hidden relative ${isDragging ? "!shadow-lg ring-2 ring-ring/20 scale-[1.02]" : ""}`}
    >
      {/* Stage stripe — left edge, matches Applications row + uses the same
       *  unified STAGE_STRIPE_CLASS so a card's hue is the same here as it is
       *  in the row view. Color updates automatically on drag-to-other-column
       *  because the parent passes the new stage. */}
      <div
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${STAGE_STRIPE_CLASS[app.stage]}`}
      />
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <h4 className="text-[13px] font-semibold text-foreground truncate min-w-0">{app.company}</h4>
        <span
          className="inline-flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground tabular-nums"
          title={health.longLabel}
          aria-label={health.longLabel}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[health.tone]}`} aria-hidden />
          {health.shortLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-1.5 truncate">{app.role}</p>
      <div className="flex flex-wrap gap-1 mb-1.5 min-w-0">
        {app.location?.trim() && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/80 text-secondary-foreground border border-border/60 truncate" title={app.location}>
            <MapPin size={9} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{app.location}</span>
          </span>
        )}
        {resumeName && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground border border-border truncate" title={resumeName}>
            <FileText size={9} strokeWidth={1.5} className="shrink-0" aria-hidden />
            <span className="truncate">{resumeName}</span>
          </span>
        )}
        {/* Detailed-only chips: salary + jobType. Surface them only when the
         *  user opted into detailed density so regular cards stay scannable. */}
        {density === "detailed" && app.salary?.trim() && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 truncate" title={app.salary}>
            <span className="opacity-70" aria-hidden>$</span>
            <span className="truncate">{app.salary}</span>
          </span>
        )}
        {density === "detailed" && app.jobType?.trim() && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/80 text-secondary-foreground border border-border/60 truncate" title={app.jobType}>
            <span className="truncate">{app.jobType}</span>
          </span>
        )}
      </div>
      {/* Detailed-only next-action hint, lifted from applicationHealth. */}
      {density === "detailed" && health.tone !== "neutral" && (
        <p className="text-[10.5px] text-muted-foreground italic mb-1.5 truncate" title={health.longLabel}>
          {health.longLabel}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{fmt(app.applicationDate)}</span>
        {isDrafting && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/applications?tailor=${app._id}`);
            }}
            className="text-[10px] font-medium text-primary hover:underline shrink-0"
            title="Tailor resume for this role"
          >
            Open in Tailor →
          </button>
        )}
      </div>
    </div>
  );
});

function SortableCard({ app, resumeName, density }: { app: Application; resumeName?: string; density: KanbanDensity }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app._id, data: { type: "card", app } });
  // `content-visibility: auto` lets the browser skip layout + paint for cards
  // outside the viewport. Cheap, native, and (unlike react-window) doesn't
  // conflict with dnd-kit which needs every sortable card mounted.
  // `contain-intrinsic-size` reserves vertical space so scroll height stays
  // stable while off-screen cards are skipped — without it the scrollbar
  // jumps as cards enter/leave the viewport.
  const cvStyle = density === "mini"
    ? { contentVisibility: "auto" as const, containIntrinsicSize: "auto 36px" }
    : density === "detailed"
      ? { contentVisibility: "auto" as const, containIntrinsicSize: "auto 200px" }
      : { contentVisibility: "auto" as const, containIntrinsicSize: "auto 140px" };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, ...cvStyle }} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      {/* Inner wrapper holds the enter animation. Keeping it OFF the outer
       *  sortable element so we never collide with dnd-kit's drag transform. */}
      <div className="kanban-card-enter">
        <KanbanCard app={app} resumeName={resumeName} density={density} />
      </div>
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({ stage, apps, resumeById, dwell, density, ghosts, terminalControl }: { stage: Stage; apps: Application[]; resumeById: Record<string, string>; dwell: { avgDays: number | null; sampleSize: number }; density: KanbanDensity; ghosts: { app: Application; fromStage: Stage }[]; terminalControl?: { value: "Offer" | "Rejected"; onChange: (s: "Offer" | "Rejected") => void; counts: Record<"Offer" | "Rejected", number> } }) {
  const c = CFG[stage];
  const { setNodeRef, isOver } = useSortable({ id: `column-${stage}`, data: { type: "column", stage } });
  const ids = useMemo(() => apps.map((a) => a._id), [apps]);

  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-t-xl ${c.hBg} min-w-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
          {terminalControl ? (
            /* Offer ⇄ Rejected segmented toggle. The terminal slot of the board
             *  hosts one of these two stages at a time so the grid stays 5-wide
             *  and Rejected never wraps below. Each side shows its live count so
             *  the hidden stage's cards aren't a surprise. */
            <div role="group" aria-label="Switch terminal stage" className="inline-flex items-center rounded-lg border border-border bg-card/80 overflow-hidden shrink-0">
              {(["Offer", "Rejected"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => terminalControl.onChange(s)}
                  aria-pressed={terminalControl.value === s}
                  title={`Show the ${s} column`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-semibold transition-colors ${
                    terminalControl.value === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${CFG[s].dot}`} aria-hidden />
                  {s}
                  <span className="text-[10px] tabular-nums opacity-70">{terminalControl.counts[s]}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <span className="text-[13px] font-semibold text-foreground truncate">{stage}</span>
              <span className="text-[11px] text-muted-foreground ml-auto bg-white/70 dark:bg-black/25 px-2 py-0.5 rounded-full font-semibold tabular-nums shrink-0">{apps.length}</span>
            </>
          )}
        </div>
        {/* WIP-style stage stat: average closed-transition dwell time.
         *  Null when the user has no sample of apps that have moved through
         *  this stage yet. Computed in utils/stageStats.ts. */}
        <p
          className="text-[10.5px] text-muted-foreground/80 tabular-nums truncate ml-[18px]"
          title={dwell.sampleSize > 0 ? `Avg across ${dwell.sampleSize} closed transition${dwell.sampleSize === 1 ? "" : "s"}` : "No closed transitions yet"}
        >
          {dwell.avgDays != null
            ? `Avg ${dwell.avgDays}d in ${stage}`
            : "Not enough history"}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 rounded-b-xl border-2 border-dashed ${c.border} ${c.bg} min-h-[120px] min-w-0 space-y-2 ${isOver ? "!border-foreground/25 !bg-muted/40" : ""}`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {apps.map((app) => (
            <SortableCard key={app._id} app={app} resumeName={app.resumeId ? resumeById[app.resumeId] : undefined} density={density} />
          ))}
        </SortableContext>
        {/* Predicted-destination ghost cards. Rendered AFTER real cards so they
         *  never push live work below the fold. The prediction logic + cap
         *  live in the parent — this column just renders what it's handed. */}
        {ghosts.length > 0 && (
          <div className="pt-2 mt-2 border-t border-dashed border-border/60 space-y-2" role="region" aria-label={`${ghosts.length} predicted ${stage} card${ghosts.length === 1 ? "" : "s"}`}>
            {ghosts.map((g) => (
              <GhostKanbanCard key={`ghost-${g.app._id}`} app={g.app} fromStage={g.fromStage} />
            ))}
          </div>
        )}
        {apps.length === 0 && ghosts.length === 0 && <div className="flex items-center justify-center h-16 text-xs text-muted-foreground dark:text-secondary-foreground">Drop here</div>}
      </div>
    </div>
  );
});

/** Filter button shaped like a small select. Wraps ActionDropdown so the
 *  Kanban filter row stays visually compact while keeping the canonical
 *  dropdown behaviour (outside-click, Esc, searchable). */
/** Predicted next-stage ghost card. Rendered inside the predicted destination
 *  column to give the user a "heads up" on where this app is statistically
 *  likely to end up. Clicking jumps to the real card on the Applications page
 *  (where the user can act on it). Not sortable — dnd-kit ignores it. */
const GhostKanbanCard = memo(function GhostKanbanCard({ app, fromStage }: { app: Application; fromStage: Stage }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/applications?focus=${app._id}`)}
      className="kanban-card-ghost card-premium p-2.5 min-w-0 w-full overflow-hidden border-dashed text-left transition-opacity"
      title={`Likely to land here based on stuck-in-${fromStage} signal — click to focus the real card.`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ChevronRight size={11} strokeWidth={2} aria-hidden className="text-muted-foreground shrink-0" />
        <span className="text-[12px] font-medium text-foreground/80 truncate flex-1">{app.company}</span>
      </div>
      <p className="text-[10.5px] text-muted-foreground italic mt-0.5 truncate">
        Likely · from {fromStage}
      </p>
    </button>
  );
});

function FilterTrigger({ label, value, items, searchable }: { label: string; value: string; items: DropdownItem[]; searchable?: boolean }) {
  const isActive = value !== "All";
  return (
    <ActionDropdown
      items={items}
      searchable={searchable}
      searchPlaceholder={`Search ${label.toLowerCase()}...`}
      menuWidth="w-56"
      align="left"
      trigger={
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-lg border px-2.5 py-1 transition-colors ${
            isActive
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
          }`}
        >
          <span>{label}:</span>
          <span className="truncate max-w-[120px]">{value}</span>
          <ChevronDown size={10} strokeWidth={2} aria-hidden />
        </button>
      }
    />
  );
}

export default function Kanban() {
  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [density, setDensityRaw] = useState<KanbanDensity>(() => readDensity());
  /* Filters: session-only by design — a reload returns the user to "everything
   * visible" rather than carrying a stale narrow view. None affect dwell stats
   * (those are still computed from the full app history). */
  const [resumeFilter, setResumeFilter] = useState<string>("All");
  const [companyFilter, setCompanyFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  /* The board shows 5 columns; the terminal slot hosts either Offer or Rejected
   *  (toggled in that column's header) so Rejected never wraps below the grid. */
  const [terminalStage, setTerminalStage] = useState<"Offer" | "Rejected">("Offer");
  const [bulkBusy, setBulkBusy] = useState(false);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { promptAfterStageChange } = useDeadlineFollowups();
  const lastOverStage = useRef<Stage | null>(null);

  const setDensity = useCallback((d: KanbanDensity) => {
    setDensityRaw(d);
    try { window.localStorage.setItem(DENSITY_KEY, d); } catch { /* ignore */ }
  }, []);

  const clearFilters = useCallback(() => {
    setResumeFilter("All");
    setCompanyFilter("All");
    setSourceFilter("All");
  }, []);
  const filtersActive = resumeFilter !== "All" || companyFilter !== "All" || sourceFilter !== "All";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  /* Collision detection: pointer-within first so EMPTY columns (e.g. OA /
   *  Interview with zero cards) are valid drop targets — closestCenter resolves
   *  to the nearest card center, which lives in populated columns, so empty
   *  columns could never receive a drop. Fall back to rect-intersection when the
   *  pointer is between droppables mid-drag. */
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  }, []);

  /* Drafting · Applied · OA · Interview are always shown; the 5th column is the
   *  toggled terminal stage. Keeps the grid exactly 5-wide. */
  const visibleStages = useMemo<Stage[]>(
    () => ["Drafting", "Applied", "OA", "Interview", terminalStage],
    [terminalStage],
  );

  const resumeById = useMemo(() => Object.fromEntries(resumes.map((r) => [r._id, r.name])), [resumes]);

  const fetchApps = useCallback(async () => {
    try {
      const [res, arch, rList] = await Promise.all([
        applicationsAPI.getAll({ limit: 999, archived: "false" }),
        applicationsAPI.getAll({ limit: 1, archived: "true" }),
        resumesAPI.getAll(),
      ]);
      setApps(res.data);
      setArchivedCount(arch.pagination.total);
      setResumes(rList);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchApps(); }, [fetchApps]);
  useRefetchOnFocus(fetchApps);

  /* Build option lists from the full unfiltered set so the dropdowns always
   * show every value the user could pick — narrowing one filter never hides
   * options from another. */
  const filterOptions = useMemo(() => {
    const companies = new Set<string>();
    const resumeIds = new Set<string>();
    const sources = new Set<string>();
    for (const a of apps) {
      if (a.company) companies.add(a.company);
      if (a.resumeId) resumeIds.add(a.resumeId);
      if (a.source) sources.add(a.source);
    }
    return {
      companies: [...companies].sort(),
      resumes: [...resumeIds].map((id) => ({ id, name: resumeById[id] || "Untitled resume" })).sort((a, b) => a.name.localeCompare(b.name)),
      sources: [...sources].sort(),
    };
  }, [apps, resumeById]);

  /* Visible apps after filtering. Each filter narrows independently; an app
   * must satisfy all active filters. Dwell stats below still use the full
   * `apps` array so the column averages don't lie when the user slices. */
  const visibleApps = useMemo(() => {
    return apps.filter((a) => {
      if (companyFilter !== "All" && a.company !== companyFilter) return false;
      if (resumeFilter !== "All" && a.resumeId !== resumeFilter) return false;
      if (sourceFilter !== "All") {
        if ((a.source || "manual") !== sourceFilter) return false;
      }
      return true;
    });
  }, [apps, companyFilter, resumeFilter, sourceFilter]);

  const grouped = useMemo(() => {
    const g: Record<Stage, Application[]> = { Drafting: [], Applied: [], OA: [], Interview: [], Offer: [], Rejected: [] };
    visibleApps.forEach((a) => { if (g[a.stage]) g[a.stage].push(a); });
    return g;
  }, [visibleApps]);

  /* WIP-style stage stats: average days an app spends in each stage before
   * transitioning out. Computed across the user's full history (not just
   * current cards). See utils/stageStats.ts. */
  const dwell = useMemo(() => dwellAverages(apps), [apps]);

  /* Smart suggestion: applications currently in Applied that have been sitting
   * there longer than the "stuck" threshold. Prompts the user to bulk-archive
   * (or mark rejected) so the column doesn't become a graveyard.
   *
   * We only surface this when (a) the threshold-passing apps are not already
   * filtered out by an active company/resume/source filter (otherwise the
   * suggested count would silently include hidden rows) and (b) the count is
   * meaningful — fewer than 3 isn't worth interrupting the user. */
  const STUCK_DAYS = 30;
  const STUCK_MIN = 3;
  const stuckApplied = useMemo(() => {
    const now = new Date();
    return visibleApps.filter((a) => a.stage === "Applied" && currentStageDwell(a, now) > STUCK_DAYS);
  }, [visibleApps]);
  const showStuckSuggestion = !suggestionDismissed && stuckApplied.length >= STUCK_MIN;

  /* Predicted-destination "ghost" cards. v1 rule: stuck active-stage apps are
   * statistically likely to end up Rejected. The longer they've been stuck,
   * the higher the rank. We surface up to GHOST_CAP ghosts in Rejected, sorted
   * by current-stage-dwell desc. The user has visibility before they're
   * surprised by a 4-month-stale Applied row.
   *
   * Future: derive transition rates from the user's actual history. */
  const GHOST_CAP = 3;
  const GHOST_THRESHOLDS: Partial<Record<Stage, number>> = { Applied: 45, OA: 21, Interview: 30 };
  const ghostMap = useMemo<Record<Stage, { app: Application; fromStage: Stage }[]>>(() => {
    const empty: Record<Stage, { app: Application; fromStage: Stage }[]> = {
      Drafting: [], Applied: [], OA: [], Interview: [], Offer: [], Rejected: [],
    };
    const now = new Date();
    const candidates: { app: Application; fromStage: Stage; dwell: number }[] = [];
    for (const a of visibleApps) {
      const threshold = GHOST_THRESHOLDS[a.stage];
      if (threshold == null) continue;
      const dwell = currentStageDwell(a, now);
      if (dwell <= threshold) continue;
      candidates.push({ app: a, fromStage: a.stage, dwell });
    }
    // Most-stuck first, capped.
    candidates.sort((x, y) => y.dwell - x.dwell);
    empty.Rejected = candidates.slice(0, GHOST_CAP).map(({ app, fromStage }) => ({ app, fromStage }));
    return empty;
  }, [visibleApps]);

  const handleBulkArchive = useCallback(async () => {
    const ok = await confirm(
      `Archive ${stuckApplied.length} application${stuckApplied.length === 1 ? "" : "s"} stuck in Applied for >30 days? They'll move to the archive — you can restore individually later.`,
      { title: "Archive stale applications?", confirmLabel: "Archive all", danger: false },
    );
    if (!ok) return;
    setBulkBusy(true);
    const ids = stuckApplied.map((a) => a._id);
    try {
      await Promise.all(ids.map((id) => applicationsAPI.archive(id, "auto_stale")));
      toast.success(`Archived ${ids.length} application${ids.length === 1 ? "" : "s"}`);
      await fetchApps();
    } catch {
      toast.error("Couldn't archive some applications — try again.");
    } finally { setBulkBusy(false); }
  }, [stuckApplied, confirm, fetchApps]);

  const handleBulkReject = useCallback(async () => {
    const ok = await confirm(
      `Mark ${stuckApplied.length} application${stuckApplied.length === 1 ? "" : "s"} as Rejected? Useful when you've given up on them but want them counted in your response-rate.`,
      { title: "Bulk mark as Rejected?", confirmLabel: "Mark as Rejected", danger: false },
    );
    if (!ok) return;
    setBulkBusy(true);
    const ids = stuckApplied.map((a) => a._id);
    try {
      await Promise.all(ids.map((id) => applicationsAPI.update(id, { stage: "Rejected" })));
      toast.success(`Marked ${ids.length} as Rejected`);
      await fetchApps();
    } catch {
      toast.error("Couldn't update some applications — try again.");
    } finally { setBulkBusy(false); }
  }, [stuckApplied, confirm, fetchApps]);

  const findStage = useCallback((id: string): Stage | null => {
    for (const s of STAGES) if (grouped[s].some((a) => a._id === id)) return s;
    return null;
  }, [grouped]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const app = apps.find((a) => a._id === e.active.id);
    if (app) { setActiveApp(app); lastOverStage.current = app.stage; }
  }, [apps]);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    const overId = over.id as string;
    const targetStage = overId.startsWith("column-")
      ? overId.replace("column-", "") as Stage
      : findStage(overId);

    if (!targetStage) return;

    // Avoid re-rendering on every pointer move: only update when the hovered stage changes.
    if (targetStage === lastOverStage.current) return;
    lastOverStage.current = targetStage;

    setApps((prev) => prev.map((a) => a._id === active.id ? { ...a, stage: targetStage } : a));
  }, [findStage]);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveApp(null);
    lastOverStage.current = null;
    if (!over) return;

    const overId = over.id as string;
    const targetStage = overId.startsWith("column-")
      ? overId.replace("column-", "") as Stage
      : findStage(overId);

    if (!targetStage) return;

    try {
      // Capture the BEFORE-stage from the apps array (handleDragOver may have
      // already mutated `apps`, so use a snapshot before the API call).
      const target = apps.find((a) => a._id === active.id);
      const fromStage = target?.stage;
      await applicationsAPI.update(active.id as string, { stage: targetStage });
      toast.success(`Moved to ${targetStage}`);
      fetchApps();
      // Phase-3 cross-cutting: prompt to auto-close related open deadlines.
      if (target && fromStage && fromStage !== targetStage) {
        void promptAfterStageChange({
          applicationId: String(active.id),
          companyName: target.company,
          fromStage,
          toStage: targetStage,
        });
      }
    } catch {
      fetchApps();
    }
  }, [findStage, fetchApps, apps, promptAfterStageChange]);

  if (loading) return (
    <div className="fade-up">
      <h1 className="text-2xl font-bold text-foreground mb-6">Kanban Board</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">{STAGES.map((s) => <div key={s} className="min-w-0 space-y-2"><SkeletonCard /><SkeletonCard /></div>)}</div>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Drag applications between stages</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filters: slice visible cards by resume, company, source. Each
           *  filter is independent and intersects with the others. Dwell
           *  stats below the column headers are NOT filtered — they always
           *  reflect the user's full history. */}
          <FilterTrigger
            label="Resume"
            value={resumeFilter === "All" ? "All" : (resumeById[resumeFilter] ?? "Unknown")}
            items={[
              { label: "All resumes", onClick: () => setResumeFilter("All"), className: resumeFilter === "All" ? "font-semibold text-primary" : undefined },
              { label: "—", onClick: () => undefined, disabled: true, divider: true },
              ...filterOptions.resumes.map((r) => ({
                label: r.name,
                onClick: () => setResumeFilter(r.id),
                className: resumeFilter === r.id ? "font-semibold text-primary" : undefined,
              })),
            ]}
            searchable={filterOptions.resumes.length > 6}
          />
          <FilterTrigger
            label="Company"
            value={companyFilter === "All" ? "All" : companyFilter}
            items={[
              { label: "All companies", onClick: () => setCompanyFilter("All"), className: companyFilter === "All" ? "font-semibold text-primary" : undefined },
              { label: "—", onClick: () => undefined, disabled: true, divider: true },
              ...filterOptions.companies.map((c) => ({
                label: c,
                onClick: () => setCompanyFilter(c),
                className: companyFilter === c ? "font-semibold text-primary" : undefined,
              })),
            ]}
            searchable={filterOptions.companies.length > 6}
          />
          <FilterTrigger
            label="Source"
            value={sourceFilter === "All" ? "All" : sourceFilter}
            items={[
              { label: "All sources", onClick: () => setSourceFilter("All"), className: sourceFilter === "All" ? "font-semibold text-primary" : undefined },
              { label: "—", onClick: () => undefined, disabled: true, divider: true },
              ...["manual", "extension", "email"].map((s) => ({
                label: s,
                onClick: () => setSourceFilter(s),
                className: sourceFilter === s ? "font-semibold text-primary" : undefined,
                disabled: !filterOptions.sources.includes(s),
              })),
            ]}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
          {/* Density toggle. Mini = scan-only one-liner, regular = current default,
           *  detailed = adds salary / jobType chips and a next-action hint. */}
          <div role="group" aria-label="Card density" className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden">
            {(["mini", "regular", "detailed"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                className={`px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  density === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
                title={`${d.charAt(0).toUpperCase() + d.slice(1)} cards`}
              >
                {d}
              </button>
            ))}
          </div>
          {archivedCount > 0 && (
            <Link to="/applications" className="text-sm text-muted-foreground hover:text-foreground">
              Archived: {archivedCount}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {filtersActive ? `${visibleApps.length} of ${apps.length}` : `${apps.length} applications`}
          </span>
        </div>
      </div>
      {showStuckSuggestion && (
        <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} strokeWidth={1.8} className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
            <p className="text-sm text-amber-800 dark:text-amber-100">
              <span className="font-semibold">{stuckApplied.length} application{stuckApplied.length === 1 ? "" : "s"}</span>{" "}
              stuck in Applied for &gt;{STUCK_DAYS} days. Cleanup or move them along?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkReject}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-800/40 disabled:opacity-50"
            >
              Mark as Rejected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkArchive}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {bulkBusy ? "Working…" : "Archive all"}
            </button>
            <button
              type="button"
              onClick={() => setSuggestionDismissed(true)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-800/40"
              aria-label="Dismiss suggestion"
              title="Dismiss"
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pb-4">
          <SortableContext items={visibleStages.map((s) => `column-${s}`)}>
            {visibleStages.map((s) => (
              <KanbanColumn
                key={s}
                stage={s}
                apps={grouped[s]}
                resumeById={resumeById}
                dwell={dwell[s]}
                density={density}
                ghosts={ghostMap[s]}
                terminalControl={
                  s === terminalStage
                    ? { value: terminalStage, onChange: setTerminalStage, counts: { Offer: grouped.Offer.length, Rejected: grouped.Rejected.length } }
                    : undefined
                }
              />
            ))}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeApp && (
            <KanbanCard
              app={activeApp}
              resumeName={activeApp.resumeId ? resumeById[activeApp.resumeId] : undefined}
              isDragging
              density={density}
            />
          )}
        </DragOverlay>
      </DndContext>
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
