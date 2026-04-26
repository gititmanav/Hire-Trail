/**
 * Stage columns with @dnd-kit drag/drop; stage updates persist via applications API.
 */
import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { applicationsAPI, resumesAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import type { Application, Resume, Stage } from "../../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];
const CFG: Record<Stage, { dot: string; hBg: string; border: string; bg: string }> = {
  Applied: { dot: "bg-blue-500", hBg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40", bg: "bg-blue-50/30 dark:bg-blue-950/20" },
  OA: { dot: "bg-warning", hBg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40", bg: "bg-amber-50/30 dark:bg-amber-950/20" },
  Interview: { dot: "bg-purple-500", hBg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200/60 dark:border-purple-800/40", bg: "bg-purple-50/30 dark:bg-purple-950/20" },
  Offer: { dot: "bg-success", hBg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40", bg: "bg-emerald-50/30 dark:bg-emerald-950/20" },
  Rejected: { dot: "bg-danger", hBg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200/60 dark:border-red-800/40", bg: "bg-red-50/30 dark:bg-red-950/20" },
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const KanbanCard = memo(function KanbanCard({ app, resumeName, isDragging }: { app: Application; resumeName?: string; isDragging?: boolean }) {
  return (
    <div
      className={`card-premium p-3 ${isDragging ? "!shadow-lg ring-2 ring-ring/20 scale-[1.02]" : ""}`}
    >
      <h4 className="text-[13px] font-semibold text-foreground mb-0.5 truncate">{app.company}</h4>
      <p className="text-xs text-muted-foreground mb-1.5 truncate">{app.role}</p>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {app.location?.trim() && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/80 text-secondary-foreground border border-border/60 truncate" title={app.location}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70" aria-hidden>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{app.location}</span>
          </span>
        )}
        {resumeName && (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground border border-border truncate" title={resumeName}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0" aria-hidden>
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
              <path d="M13 2v7h7" />
            </svg>
            <span className="truncate">{resumeName}</span>
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">{fmt(app.applicationDate)}</span>
    </div>
  );
});

function SortableCard({ app, resumeName }: { app: Application; resumeName?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app._id, data: { type: "card", app } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <KanbanCard app={app} resumeName={resumeName} />
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({ stage, apps, resumeById }: { stage: Stage; apps: Application[]; resumeById: Record<string, string> }) {
  const c = CFG[stage];
  const { setNodeRef, isOver } = useSortable({ id: `column-${stage}`, data: { type: "column", stage } });
  const ids = useMemo(() => apps.map((a) => a._id), [apps]);

  return (
    <div className="flex flex-col min-w-[240px] flex-1">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl ${c.hBg}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
        <span className="text-[13px] font-semibold text-foreground">{stage}</span>
        <span className="text-[11px] text-muted-foreground ml-auto bg-white/70 dark:bg-black/25 px-2 py-0.5 rounded-full font-semibold tabular-nums">{apps.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 rounded-b-xl border-2 border-dashed ${c.border} ${c.bg} min-h-[120px] space-y-2 ${isOver ? "!border-foreground/25 !bg-muted/40" : ""}`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {apps.map((app) => (
            <SortableCard key={app._id} app={app} resumeName={app.resumeId ? resumeById[app.resumeId] : undefined} />
          ))}
        </SortableContext>
        {apps.length === 0 && <div className="flex items-center justify-center h-16 text-xs text-muted-foreground dark:text-secondary-foreground">Drop here</div>}
      </div>
    </div>
  );
});

export default function Kanban() {
  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const lastOverStage = useRef<Stage | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const grouped = useMemo(() => {
    const g: Record<Stage, Application[]> = { Applied: [], OA: [], Interview: [], Offer: [], Rejected: [] };
    apps.forEach((a) => { if (g[a.stage]) g[a.stage].push(a); });
    return g;
  }, [apps]);

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
      await applicationsAPI.update(active.id as string, { stage: targetStage });
      toast.success(`Moved to ${targetStage}`);
      fetchApps();
    } catch {
      fetchApps();
    }
  }, [findStage, fetchApps]);

  if (loading) return (
    <div className="fade-up">
      <h1 className="text-2xl font-bold text-foreground mb-6">Kanban Board</h1>
      <div className="flex gap-4">{STAGES.map((s) => <div key={s} className="min-w-[240px] flex-1 space-y-2"><SkeletonCard /><SkeletonCard /></div>)}</div>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Drag applications between stages</p>
        </div>
        <div className="flex items-center gap-4">
          {archivedCount > 0 && (
            <Link to="/applications" className="text-sm text-muted-foreground hover:text-foreground">
              Archived: {archivedCount}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{apps.length} applications</span>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <SortableContext items={STAGES.map((s) => `column-${s}`)}>
            {STAGES.map((s) => <KanbanColumn key={s} stage={s} apps={grouped[s]} resumeById={resumeById} />)}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeApp && (
            <KanbanCard
              app={activeApp}
              resumeName={activeApp.resumeId ? resumeById[activeApp.resumeId] : undefined}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
