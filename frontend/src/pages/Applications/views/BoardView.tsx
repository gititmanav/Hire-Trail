/**
 * Board view — stage columns with @dnd-kit drag and drop.
 *
 * Reads the same "all applications" cache as the table list (switching List ⇄
 * Board is instant) with filters from the page header. Moves are optimistic
 * through useMoveStage: the card lands the instant you drop it; a failed save
 * snaps it back with a toast. Clicking a card opens its application page.
 */
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin, rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { AlertTriangle, ChevronRight, FileText, MapPin, X } from "lucide-react";
import { SkeletonCard } from "../../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import { useConfirm } from "../../../hooks/useConfirm.ts";
import { applicationsAPI } from "../../../utils/api.ts";
import { computeAppHealth, HEALTH_DOT_CLASS } from "../../../utils/applicationHealth.ts";
import { STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { dwellAverages, currentStageDwell } from "../../../utils/stageStats.ts";
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams } from "../data/filters.ts";
import { useAllApplications, useArchiveMutation, useResumes } from "../data/queries.ts";
import { useMoveStage } from "../data/useMoveStage.ts";
import { useOpenApplication } from "./shared.tsx";
import { useQueryClient } from "@tanstack/react-query";
import type { Application, Stage } from "../../../types";

const STAGES: Stage[] = ["Drafting", "Applied", "OA", "Interview", "Offer", "Rejected"];

/** Column surface tints. Dots come from the shared STAGE_STRIPE_CLASS so a
 *  stage reads the same colour on every surface. */
const COLUMN: Record<Stage, { head: string; border: string; body: string }> = {
  Drafting: { head: "bg-slate-50 dark:bg-slate-800/30", border: "border-slate-200/60 dark:border-slate-700/50", body: "bg-slate-50/40 dark:bg-slate-900/20" },
  Applied: { head: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40", body: "bg-blue-50/30 dark:bg-blue-950/20" },
  OA: { head: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40", body: "bg-amber-50/30 dark:bg-amber-950/20" },
  Interview: { head: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200/60 dark:border-purple-800/40", body: "bg-purple-50/30 dark:bg-purple-950/20" },
  Offer: { head: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40", body: "bg-emerald-50/30 dark:bg-emerald-950/20" },
  Rejected: { head: "bg-red-50 dark:bg-red-900/20", border: "border-red-200/60 dark:border-red-800/40", body: "bg-red-50/30 dark:bg-red-950/20" },
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const STUCK_DAYS = 30;
const STUCK_MIN = 3;
const GHOST_CAP = 3;
const GHOST_THRESHOLDS: Partial<Record<Stage, number>> = { Applied: 45, OA: 21, Interview: 30 };

/* ─── Card ─── */

const BoardCard = memo(function BoardCard({ app, resumeName, isDragging, onTailor }: {
  app: Application; resumeName?: string; isDragging?: boolean; onTailor?: (id: string) => void;
}) {
  const health = computeAppHealth(app);
  const isDrafting = app.stage === "Drafting" && !!app.tailorSessionId;
  return (
    <div className={`card-premium p-3 min-w-0 overflow-hidden relative ${isDragging ? "!shadow-lg ring-2 ring-ring/20 scale-[1.02]" : ""}`}>
      <div aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${STAGE_STRIPE_CLASS[app.stage]}`} />
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <h4 className="text-[13px] font-semibold text-foreground truncate min-w-0">{app.company}</h4>
        <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground tabular-nums" title={health.longLabel} aria-label={health.longLabel}>
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
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{fmt(app.applicationDate)}</span>
        {isDrafting && onTailor && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onTailor(app._id); }}
            className="text-[10px] font-medium text-primary hover:underline shrink-0"
          >
            Open in Tailor →
          </button>
        )}
      </div>
    </div>
  );
});

function SortableCard({ app, resumeName, onOpen, onTailor }: {
  app: Application; resumeName?: string; onOpen: (app: Application, e: React.MouseEvent) => void; onTailor: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app._id, data: { type: "card", app } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
      {...attributes}
      {...listeners}
      // The pointer sensor needs 8px of travel before a drag starts, so a
      // plain click falls through to here and opens the application.
      onClick={(e) => onOpen(app, e)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(app, e as unknown as React.MouseEvent);
      }}
      aria-label={`${app.role} at ${app.company}, ${app.stage}`}
      className="cursor-grab active:cursor-grabbing rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="kanban-card-enter">
        <BoardCard app={app} resumeName={resumeName} onTailor={onTailor} />
      </div>
    </div>
  );
}

const GhostCard = memo(function GhostCard({ app, fromStage, onOpen }: { app: Application; fromStage: Stage; onOpen: (app: Application, e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(app, e)}
      className="kanban-card-ghost card-premium p-2.5 min-w-0 w-full overflow-hidden border-dashed text-left transition-opacity"
      title={`Likely to land here — stuck in ${fromStage} longer than usual.`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ChevronRight size={11} strokeWidth={2} aria-hidden className="text-muted-foreground shrink-0" />
        <span className="text-[12px] font-medium text-foreground/80 truncate flex-1">{app.company}</span>
      </div>
      <p className="text-[10.5px] text-muted-foreground italic mt-0.5 truncate">Likely · from {fromStage}</p>
    </button>
  );
});

/* ─── Column ─── */

function Column({ stage, apps, resumeById, dwell, ghosts, terminal, onOpen, onTailor }: {
  stage: Stage;
  apps: Application[];
  resumeById: Map<string, string>;
  dwell: { avgDays: number | null; sampleSize: number };
  ghosts: { app: Application; fromStage: Stage }[];
  terminal?: { value: "Offer" | "Rejected"; onChange: (s: "Offer" | "Rejected") => void; counts: Record<"Offer" | "Rejected", number> };
  onOpen: (app: Application, e: React.MouseEvent) => void;
  onTailor: (id: string) => void;
}) {
  const c = COLUMN[stage];
  const { setNodeRef, isOver } = useSortable({ id: `column-${stage}`, data: { type: "column", stage } });
  const ids = useMemo(() => apps.map((a) => a._id), [apps]);
  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-t-xl ${c.head} min-w-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${STAGE_STRIPE_CLASS[stage]} shrink-0`} aria-hidden />
          {terminal ? (
            /* The terminal slot hosts Offer or Rejected so the grid stays 5-wide. */
            <div role="group" aria-label="Show Offer or Rejected" className="inline-flex items-center rounded-lg border border-border bg-card/80 overflow-hidden shrink-0">
              {(["Offer", "Rejected"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => terminal.onChange(s)}
                  aria-pressed={terminal.value === s}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-semibold transition-colors ${terminal.value === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STAGE_STRIPE_CLASS[s]}`} aria-hidden />
                  {s}
                  <span className="text-[10px] tabular-nums opacity-70">{terminal.counts[s]}</span>
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
        <p
          className="text-[10.5px] text-muted-foreground/80 tabular-nums truncate ml-[18px]"
          title={dwell.sampleSize > 0 ? `Average across ${dwell.sampleSize} move${dwell.sampleSize === 1 ? "" : "s"} out of ${stage}` : "No moves out of this stage yet"}
        >
          {dwell.avgDays != null ? `Avg ${dwell.avgDays}d in ${stage}` : "Not enough history"}
        </p>
      </div>
      <div ref={setNodeRef} className={`flex-1 p-2 rounded-b-xl border-2 border-dashed ${c.border} ${c.body} min-h-[120px] min-w-0 space-y-2 transition-colors ${isOver ? "!border-foreground/25 !bg-muted/40" : ""}`}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {apps.map((app) => (
            <SortableCard key={app._id} app={app} resumeName={app.resumeId ? resumeById.get(app.resumeId) : undefined} onOpen={onOpen} onTailor={onTailor} />
          ))}
        </SortableContext>
        {ghosts.length > 0 && (
          <div className="pt-2 mt-2 border-t border-dashed border-border/60 space-y-2" role="region" aria-label={`${ghosts.length} likely ${stage}`}>
            {ghosts.map((g) => <GhostCard key={`ghost-${g.app._id}`} app={g.app} fromStage={g.fromStage} onOpen={onOpen} />)}
          </div>
        )}
        {apps.length === 0 && ghosts.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">Drop here</div>
        )}
      </div>
    </div>
  );
}

/* ─── Board ─── */

export default function BoardView() {
  const shell = useApplicationsShell();
  const { filters } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: resumes = [] } = useResumes();
  const moveStage = useMoveStage();
  const archive = useArchiveMutation();
  const qc = useQueryClient();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const [terminalStage, setTerminalStage] = useState<"Offer" | "Rejected">("Offer");
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** While dragging: where the card is hovering (preview only — the cache
   *  changes on drop). */
  const [dragOver, setDragOver] = useState<{ id: string; stage: Stage } | null>(null);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const lastOverStage = useRef<Stage | null>(null);

  const apps = data?.data ?? [];
  const resumeById = useMemo(() => new Map(resumes.map((r) => [r._id, r.name])), [resumes]);
  const visibleStages = useMemo<Stage[]>(() => ["Drafting", "Applied", "OA", "Interview", terminalStage], [terminalStage]);

  const grouped = useMemo(() => {
    const g: Record<Stage, Application[]> = { Drafting: [], Applied: [], OA: [], Interview: [], Offer: [], Rejected: [] };
    for (const a of apps) {
      const stage = dragOver?.id === a._id ? dragOver.stage : a.stage;
      g[stage]?.push(a);
    }
    return g;
  }, [apps, dragOver]);

  // Board order (column by column) is what the detail page's J/K walks.
  const orderedIds = useMemo(() => visibleStages.flatMap((s) => grouped[s].map((a) => a._id)), [visibleStages, grouped]);
  const open = useOpenApplication(orderedIds);

  const dwell = useMemo(() => dwellAverages(apps), [apps]);

  const stuckApplied = useMemo(() => {
    const now = new Date();
    return apps.filter((a) => a.stage === "Applied" && currentStageDwell(a, now) > STUCK_DAYS);
  }, [apps]);
  const showStuck = !suggestionDismissed && filters.status === "active" && stuckApplied.length >= STUCK_MIN;

  const ghostMap = useMemo(() => {
    const now = new Date();
    const candidates = apps
      .map((a) => ({ app: a, fromStage: a.stage, dwell: currentStageDwell(a, now), threshold: GHOST_THRESHOLDS[a.stage] }))
      .filter((c) => c.threshold != null && c.dwell > c.threshold)
      .sort((x, y) => y.dwell - x.dwell)
      .slice(0, GHOST_CAP);
    return { Rejected: candidates.map(({ app, fromStage }) => ({ app, fromStage })) } as Partial<Record<Stage, { app: Application; fromStage: Stage }[]>>;
  }, [apps]);

  /* ─── Drag and drop ─── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Space picks a card up / drops it; Enter stays free to open the card.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  // pointerWithin first so EMPTY columns are valid targets; fall back to rect
  // intersection when the pointer is between droppables.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
  }, []);

  const stageOf = useCallback((overId: string): Stage | null => {
    if (overId.startsWith("column-")) return overId.slice("column-".length) as Stage;
    return apps.find((a) => a._id === overId)?.stage ?? null;
  }, [apps]);

  const onDragStart = useCallback((e: DragStartEvent) => {
    const app = apps.find((a) => a._id === e.active.id) ?? null;
    setActiveApp(app);
    lastOverStage.current = app?.stage ?? null;
  }, [apps]);

  const onDragOver = useCallback((e: DragOverEvent) => {
    if (!e.over) return;
    const stage = stageOf(String(e.over.id));
    if (!stage || stage === lastOverStage.current) return;
    lastOverStage.current = stage;
    setDragOver({ id: String(e.active.id), stage });
  }, [stageOf]);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    // The ORIGINAL app from drag start — the preview never mutated it, so the
    // "from" stage is real (the old board lost it and skipped the deadline prompt).
    const app = activeApp;
    const target = e.over ? stageOf(String(e.over.id)) : null;
    setActiveApp(null);
    setDragOver(null);
    lastOverStage.current = null;
    if (app && target) moveStage(app, target);
  }, [activeApp, stageOf, moveStage]);

  const onDragCancel = useCallback(() => {
    setActiveApp(null);
    setDragOver(null);
    lastOverStage.current = null;
  }, []);

  /* ─── Stale cleanup ─── */
  const bulkArchiveStuck = async () => {
    const n = stuckApplied.length;
    const ok = await confirm(`Archive ${n} application${n === 1 ? "" : "s"} stuck in Applied for more than ${STUCK_DAYS} days? You can restore them anytime.`, { title: "Archive stale applications?", confirmLabel: "Archive all", danger: false });
    if (!ok) return;
    archive.mutate({ ids: stuckApplied.map((a) => a._id), archived: true }, { onSuccess: () => toast.success(`Archived ${n} application${n === 1 ? "" : "s"}`) });
  };
  const bulkRejectStuck = async () => {
    const n = stuckApplied.length;
    const ok = await confirm(`Mark ${n} application${n === 1 ? "" : "s"} as Rejected? They'll count toward your response rate.`, { title: "Mark as Rejected?", confirmLabel: "Mark as Rejected", danger: false });
    if (!ok) return;
    setBulkBusy(true);
    try {
      await Promise.all(stuckApplied.map((a) => applicationsAPI.update(a._id, { stage: "Rejected" })));
      toast.success(`Marked ${n} as Rejected`);
    } catch {
      toast.error("Some applications couldn't be updated. Please try again.");
    } finally {
      setBulkBusy(false);
      void qc.invalidateQueries({ queryKey: ["applications"] });
    }
  };

  if (isPending) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {visibleStages.map((s) => <div key={s} className="min-w-0 space-y-2"><SkeletonCard /><SkeletonCard /></div>)}
      </div>
    );
  }

  return (
    <div>
      {showStuck && (
        <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} strokeWidth={1.8} className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
            <p className="text-sm text-amber-800 dark:text-amber-100">
              <span className="font-semibold">{stuckApplied.length} application{stuckApplied.length === 1 ? "" : "s"}</span> stuck in Applied for more than {STUCK_DAYS} days. Clean up or move them along?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" disabled={bulkBusy} onClick={bulkRejectStuck}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-800/40 disabled:opacity-50">
              Mark as Rejected
            </button>
            <button type="button" disabled={bulkBusy || archive.isPending} onClick={bulkArchiveStuck}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
              {bulkBusy ? "Working…" : "Archive all"}
            </button>
            <button type="button" onClick={() => setSuggestionDismissed(true)} aria-label="Dismiss suggestion"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40">
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pb-4">
          <SortableContext items={visibleStages.map((s) => `column-${s}`)}>
            {visibleStages.map((s) => (
              <Column
                key={s}
                stage={s}
                apps={grouped[s]}
                resumeById={resumeById}
                dwell={dwell[s]}
                ghosts={ghostMap[s] ?? []}
                onOpen={open}
                onTailor={shell.openTailor}
                terminal={s === terminalStage
                  ? { value: terminalStage, onChange: setTerminalStage, counts: { Offer: grouped.Offer.length, Rejected: grouped.Rejected.length } }
                  : undefined}
              />
            ))}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeApp && <BoardCard app={activeApp} resumeName={activeApp.resumeId ? resumeById.get(activeApp.resumeId) : undefined} isDragging />}
        </DragOverlay>
      </DndContext>

      {confirmState.open && (
        <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </div>
  );
}
