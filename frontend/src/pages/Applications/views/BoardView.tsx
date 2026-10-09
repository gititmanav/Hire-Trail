/**
 * Board view — stage columns with @dnd-kit drag and drop.
 *
 * Reads the same "all applications" cache as every list (switching views is
 * instant) with filters from the page header. Columns are neutral — colour is
 * the stage's dot, nothing more — and cards read like the lists do: the role,
 * the company and its fit, then what the application is waiting on
 * (data/focus.ts) over its ten-week trail. Rejected rests as a slim rail you
 * can still drop onto; open it and it glides out into a full column.
 *
 * Drag: cards are draggables and columns are drop zones — nothing in the
 * columns moves while you drag (a column's order is the data's, so there's
 * nothing to sort). The card you hold stays dimmed in place, the target
 * column shows a card-sized slot, and the drop is the only change. Moves are
 * optimistic through useMoveStage; a failed save snaps the card back.
 *
 * Wide boards fit the width; narrower ones scroll sideways with fixed columns.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin, rectIntersection, useDraggable, useDroppable,
  type CollisionDetection,
} from "@dnd-kit/core";
// Arrow keys jump between drop zones (it reads any droppables, not only sortables).
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronsLeftRight, Sparkles } from "lucide-react";
import CompanyLogo from "../../../components/CompanyLogo/CompanyLogo.tsx";
import Tooltip from "../../../components/ui/Tooltip.tsx";
import { usePersistentState, isBoolean } from "../../../hooks/usePersistentState.ts";
import { STAGES, STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { dwellAverages } from "../../../utils/stageStats.ts";
import { todayYmd } from "../../../utils/dates.ts";
import TrailLine from "../components/TrailLine.tsx";
import { FitCell } from "../components/RowBits.tsx";
import { TONE_CLASS } from "../components/tone.ts";
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import { useApplicationFilters, toListParams } from "../data/filters.ts";
import { LIST_CAP, useAllApplications, useOpenDeadlines, useReplyWindow } from "../data/queries.ts";
import { useMoveStage } from "../data/useMoveStage.ts";
import { nextDeadlines, rowFocus, sortApplications, trailShape, type ReplyWindow } from "../data/focus.ts";
import { useCompanyResolver, useOpenApplication } from "./shared.tsx";
import { SkeletonCard } from "../../../components/Skeleton/Skeleton.tsx";
import type { Application, Company, Deadline, Stage } from "../../../types";

const OPEN_STAGES = STAGES.filter((s) => s !== "Rejected");
const TRAIL_WINDOW: [number, number] = [-70, 0];
/** Below this the board scrolls sideways with fixed-width columns. */
const FIT_FROM = 1040;

/* ─── Card ─── */

interface CardProps {
  app: Application;
  company?: Company;
  next?: Deadline;
  rw: ReplyWindow;
  today: string;
  lifted?: boolean;
  onTailor?: (id: string) => void;
}

const BoardCard = memo(function BoardCard({ app, company, next, rw, today, lifted, onTailor }: CardProps) {
  const focus = rowFocus(app, next, rw, today);
  const shape = useMemo(() => trailShape(app, next, rw, today), [app, next, rw, today]);
  return (
    <div className={`rounded-xl border border-border bg-card px-3 pt-2.5 pb-2.5 min-w-0 transition-shadow ${lifted ? "shadow-floating ring-1 ring-border" : "shadow-panel"}`}>
      <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{app.role}</p>
      <div className="mt-1 flex items-center gap-1.5 min-w-0">
        <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="2xs" />
        <span className="text-[12px] text-muted-foreground truncate">{app.company}</span>
        <span className="ml-auto shrink-0"><FitCell fit={app.fit} bare /></span>
      </div>
      <p className={`mt-2 text-[12px] font-medium truncate ${TONE_CLASS[focus.tone]}`}>{focus.short}</p>
      {app.stage !== "Drafting" && <TrailLine shape={shape} window={TRAIL_WINDOW} className="mt-1.5" />}
      {app.stage === "Drafting" && app.tailorSessionId && onTailor && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onTailor(app._id); }}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles size={12} strokeWidth={2} aria-hidden />Open in Tailor
        </button>
      )}
    </div>
  );
});

function DraggableCard({ onOpen, ...card }: CardProps & { onOpen: (app: Application, e: React.MouseEvent) => void }) {
  // No transform: the DragOverlay is what moves; this one stays put, dimmed.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.app._id, data: { app: card.app } });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1, contentVisibility: isDragging ? "visible" : "auto", containIntrinsicSize: "auto 112px" }}
      {...attributes}
      {...listeners}
      // The pointer sensor needs 8px of travel before a drag starts, so a
      // plain click falls through to here and opens the application.
      onClick={(e) => onOpen(card.app, e)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(card.app, e as unknown as React.MouseEvent);
      }}
      aria-label={`${card.app.role} at ${card.app.company}, ${card.app.stage}`}
      className="cursor-grab active:cursor-grabbing rounded-xl transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="kanban-card-enter">
        <BoardCard {...card} />
      </div>
    </div>
  );
}

/* ─── Column ─── */

function useDropSlot(stage: Stage) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `column-${stage}`, data: { stage } });
  // Where the held card would land: a card-sized slot, in any column but its own.
  const held = active?.data.current?.app as Application | undefined;
  const slot = isOver && held && held.stage !== stage ? active?.rect.current.initial?.height ?? 112 : 0;
  return { setNodeRef, slot, dragging: !!held };
}

function ColumnHeader({ stage, count, avg, trailing }: { stage: Stage; count: number; avg: number | null; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 h-8 px-1 mb-1.5 min-w-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_STRIPE_CLASS[stage]}`} aria-hidden />
      <span className="text-[13px] font-semibold text-foreground truncate">{stage}</span>
      <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
      {avg != null && (
        <Tooltip label={`On average, applications spend ${avg} day${avg === 1 ? "" : "s"} in ${stage}`}>
          <span className="ml-auto text-[11.5px] text-muted-foreground/80 tabular-nums whitespace-nowrap">avg {avg}d</span>
        </Tooltip>
      )}
      {trailing}
    </div>
  );
}

function Column({ stage, apps, avg, render }: { stage: Stage; apps: Application[]; avg: number | null; render: (a: Application) => React.ReactNode }) {
  const { setNodeRef, slot } = useDropSlot(stage);
  return (
    <div className="board-col flex flex-col min-w-0">
      <ColumnHeader stage={stage} count={apps.length} avg={avg} />
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[140px] p-1.5 rounded-xl space-y-2 transition-colors duration-150 ${slot ? "bg-control/80" : "bg-muted/60 dark:bg-card/40"}`}
      >
        {slot > 0 && <div aria-hidden className="kanban-drop-slot rounded-xl border-2 border-dashed border-foreground/15" style={{ height: slot }} />}
        {apps.map(render)}
        {apps.length === 0 && !slot && <div className="flex items-center justify-center h-20 text-[12px] text-muted-foreground/80">Drop here</div>}
      </div>
    </div>
  );
}

/** Rejected: a slim rail you can drop onto; open, a full column. The width
 *  glides (flex-grow / flex-basis), the content crossfades. */
function RejectedColumn({ apps, open, onToggle, render }: { apps: Application[]; open: boolean; onToggle: () => void; render: (a: Application) => React.ReactNode }) {
  const { setNodeRef, slot, dragging } = useDropSlot("Rejected");
  return (
    <div className={`board-rejected ${open ? "is-open" : ""} relative flex flex-col min-w-0`}>
      {/* Rail */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`Rejected, ${apps.length}. ${open ? "Fold the column" : "Open the column"}`}
        className={`board-rail absolute inset-0 flex flex-col items-center gap-2 pt-2.5 rounded-xl transition-[opacity,background-color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "opacity-0 pointer-events-none" : `opacity-100 ${slot ? "bg-control/80" : dragging ? "bg-muted" : "bg-muted/60 hover:bg-muted dark:bg-card/40"}`
        }`}
        tabIndex={open ? -1 : 0}
      >
        <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS.Rejected}`} aria-hidden />
        <span className="[writing-mode:vertical-rl] text-[12.5px] font-semibold text-muted-foreground">Rejected · {apps.length}</span>
      </button>
      {/* Column */}
      <div className={`flex flex-col min-w-0 flex-1 transition-opacity duration-200 ${open ? "opacity-100 delay-75" : "opacity-0 pointer-events-none"}`} aria-hidden={!open}>
        <ColumnHeader
          stage="Rejected"
          count={apps.length}
          avg={null}
          trailing={
            <Tooltip label="Fold into a rail">
              <button type="button" onClick={onToggle} tabIndex={open ? 0 : -1} aria-label="Fold the Rejected column" className="ml-auto w-6 h-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronsLeftRight size={13} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
          }
        />
        <div className={`flex-1 min-h-[140px] p-1.5 rounded-xl space-y-2 ${slot ? "bg-control/80" : "bg-muted/60 dark:bg-card/40"}`}>
          {slot > 0 && <div aria-hidden className="kanban-drop-slot rounded-xl border-2 border-dashed border-foreground/15" style={{ height: slot }} />}
          {open && apps.map(render)}
        </div>
      </div>
      {/* One drop zone for both looks. */}
      <div ref={setNodeRef} className="absolute inset-0 pointer-events-none" aria-hidden />
    </div>
  );
}

/* ─── Board ─── */

export default function BoardView() {
  const shell = useApplicationsShell();
  const { filters } = useApplicationFilters();
  const params = useMemo(() => toListParams(filters), [filters]);
  const { data, isPending } = useAllApplications(params);
  const { data: deadlines = [] } = useOpenDeadlines();
  const rw = useReplyWindow();
  const moveStage = useMoveStage();
  const today = todayYmd();
  const next = useMemo(() => nextDeadlines(deadlines, today), [deadlines, today]);
  const [rejectedOpen, setRejectedOpen] = usePersistentState<boolean>("hiretrail-board-rejected-open", false, isBoolean);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  /** Dropped into another column: the card appears there, so the overlay
   *  mustn't fly back to where it started. A drop in place animates home. */
  const [landed, setLanded] = useState(false);

  const apps = useMemo(() => data?.data ?? [], [data]);
  const grouped = useMemo(() => {
    const g = Object.fromEntries(STAGES.map((s) => [s, [] as Application[]])) as Record<Stage, Application[]>;
    for (const a of apps) g[a.stage]?.push(a);
    for (const s of STAGES) g[s] = sortApplications(g[s], "smart", next, today);
    return g;
  }, [apps, next, today]);

  // Board order (column by column) is what the application page's J/K walks.
  const orderedIds = useMemo(() => [...OPEN_STAGES, ...(rejectedOpen ? ["Rejected" as Stage] : [])].flatMap((s) => grouped[s].map((a) => a._id)), [grouped, rejectedOpen]);
  const open = useOpenApplication(orderedIds);
  const resolveCompany = useCompanyResolver(apps);
  const dwell = useMemo(() => dwellAverages(apps), [apps]);

  /* Fit the width, or scroll sideways — by the board's own width. */
  const boardRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    setFits(el.clientWidth >= FIT_FROM);
    const ro = new ResizeObserver(([e]) => setFits((prev) => (prev === e.contentRect.width >= FIT_FROM ? prev : !prev)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ─── Drag and drop ─── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Space picks a card up / drops it; Enter stays free to open the card.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  // pointerWithin first so EMPTY columns (and the rail) are valid targets;
  // fall back to rect intersection when the pointer is between droppables.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
  }, []);
  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveApp((e.active.data.current?.app as Application | undefined) ?? null);
    setLanded(false);
  }, []);
  const onDragEnd = useCallback((e: DragEndEvent) => {
    const app = activeApp;
    const target = (e.over?.data.current?.stage as Stage | undefined) ?? null;
    setLanded(!!app && !!target && target !== app.stage);
    setActiveApp(null);
    if (app && target) moveStage(app, target);
  }, [activeApp, moveStage]);
  const onDragCancel = useCallback(() => { setActiveApp(null); setLanded(false); }, []);

  const card = (a: Application) => (
    <DraggableCard key={a._id} app={a} company={resolveCompany(a)} next={next.get(a._id)} rw={rw} today={today} onOpen={open} onTailor={shell.openTailor} />
  );

  return (
    <div ref={boardRef}>
      {isPending ? (
        <div className="board flex gap-3" data-fits={fits}>
          {STAGES.map((s) => (
            <div key={s} className={s === "Rejected" ? "board-rejected" : "board-col min-w-0 space-y-2 pt-9"}>
              {s !== "Rejected" && <><SkeletonCard /><SkeletonCard /></>}
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <div className={`board flex gap-3 pb-4 ${fits ? "" : "overflow-x-auto scroll-quiet -mx-4 md:-mx-6 px-4 md:px-6"}`} data-fits={fits}>
            {OPEN_STAGES.map((s) => (
              <Column key={s} stage={s} apps={grouped[s]} avg={dwell[s]?.avgDays ?? null} render={card} />
            ))}
            <RejectedColumn apps={grouped.Rejected} open={rejectedOpen} onToggle={() => setRejectedOpen(!rejectedOpen)} render={card} />
          </div>
          <DragOverlay dropAnimation={landed ? null : { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {activeApp && <BoardCard app={activeApp} company={resolveCompany(activeApp)} next={next.get(activeApp._id)} rw={rw} today={today} lifted />}
          </DragOverlay>
        </DndContext>
      )}
      {data && data.data.length >= LIST_CAP && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">Showing your {LIST_CAP.toLocaleString()} most recent applications. Narrow the filters to reach older ones.</p>
      )}
    </div>
  );
}
