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
import { applicationsAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import type { Application, Stage } from "../../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];
const CFG: Record<Stage, { dot: string; hBg: string; border: string; bg: string }> = {
  Applied: { dot: "bg-accent", hBg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40", bg: "bg-blue-50/30 dark:bg-blue-950/20" },
  OA: { dot: "bg-warning", hBg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40", bg: "bg-amber-50/30 dark:bg-amber-950/20" },
  Interview: { dot: "bg-purple-500", hBg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200/60 dark:border-purple-800/40", bg: "bg-purple-50/30 dark:bg-purple-950/20" },
  Offer: { dot: "bg-success", hBg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40", bg: "bg-emerald-50/30 dark:bg-emerald-950/20" },
  Rejected: { dot: "bg-danger", hBg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200/60 dark:border-red-800/40", bg: "bg-red-50/30 dark:bg-red-950/20" },
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const KanbanCard = memo(function KanbanCard({ app, isDragging }: { app: Application; isDragging?: boolean }) {
  return (
    <div className={`card-premium p-3 ${isDragging ? "!shadow-lg ring-2 ring-accent/20 scale-[1.02]" : ""}`}>
      <h4 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-0.5 truncate">{app.company}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{app.role}</p>
      <span className="text-[11px] text-gray-400">{fmt(app.applicationDate)}</span>
    </div>
  );
});

function SortableCard({ app }: { app: Application }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app._id, data: { type: "card", app } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <KanbanCard app={app} />
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({ stage, apps }: { stage: Stage; apps: Application[] }) {
  const c = CFG[stage];
  const { setNodeRef, isOver } = useSortable({ id: `column-${stage}`, data: { type: "column", stage } });
  const ids = useMemo(() => apps.map((a) => a._id), [apps]);

  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] flex-1">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl ${c.hBg}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
        <span className="text-[13px] font-semibold text-gray-800 dark:text-white">{stage}</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-auto bg-white/70 dark:bg-gray-800/70 px-2 py-0.5 rounded-full font-semibold">{apps.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex-1 p-2 rounded-b-xl border-2 border-dashed transition-colors duration-150 ${c.border} ${c.bg} min-h-[120px] space-y-2 ${isOver ? "!border-accent !bg-accent/5" : ""}`}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {apps.map((app) => <SortableCard key={app._id} app={app} />)}
        </SortableContext>
        {apps.length === 0 && <div className="flex items-center justify-center h-16 text-xs text-gray-400 dark:text-gray-600">Drop here</div>}
      </div>
    </div>
  );
});

export default function Kanban() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const lastOverStage = useRef<Stage | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchApps = useCallback(async () => {
    try { const res = await applicationsAPI.getAll({ limit: 999 }); setApps(res.data); }
    catch {} finally { setLoading(false); }
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Kanban Board</h1>
      <div className="flex gap-4">{STAGES.map((s) => <div key={s} className="min-w-[240px] flex-1 space-y-2"><SkeletonCard /><SkeletonCard /></div>)}</div>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Kanban Board</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Drag applications between stages</p>
        </div>
        <span className="text-sm text-gray-400">{apps.length} applications</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <SortableContext items={STAGES.map((s) => `column-${s}`)}>
            {STAGES.map((s) => <KanbanColumn key={s} stage={s} apps={grouped[s]} />)}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeApp && <KanbanCard app={activeApp} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
