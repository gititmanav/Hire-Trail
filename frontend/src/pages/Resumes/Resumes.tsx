/** Resume versions with optional PDF to Cloudinary; usage counts come from the list API. */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown, ChevronRight, Eye, FileText, LayoutGrid, List, Pencil, Plus,
  RefreshCw, Search, Star, StarOff, Trash2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { resumesAPI, authAPI, masterProfileAPI, pollMasterProfileParse } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import ResumeModal from "../../components/ResumeModal/ResumeModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { useBackgroundTasks } from "../../hooks/useBackgroundTasks.tsx";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import type { Resume, ResumeVersion, ResumeMetrics } from "../../types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Performance metrics strip — single row of percentage chips driven by the
 *  backend's per-resume aggregate (response / OA / interview / offer rates).
 *  Renders nothing when the resume has no submitted apps. Each chip's tone
 *  matches the stage palette so the Resumes page reads the same as the
 *  Applications / Kanban funnel. Click → navigate to filtered Applications
 *  view scoped to this resume (small ergonomic win — "show me the apps that
 *  drove this rate"). */
const PCT = (frac: number) => `${Math.round(frac * 100)}%`;

function MetricChip({ label, value, total, tone }: { label: string; value: number; total: number; tone: "blue" | "amber" | "purple" | "emerald" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  }[tone];
  const count = Math.round(value * total);
  return (
    <span
      className={`inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${toneClass}`}
      title={`${label}: ${count} of ${total} (${PCT(value)})`}
    >
      <span className="text-[9px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="font-semibold">{PCT(value)}</span>
    </span>
  );
}

function MetricsStrip({ metrics }: { metrics: ResumeMetrics | null | undefined }) {
  if (!metrics || metrics.total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5" aria-label="Resume performance metrics">
      <MetricChip label="Resp" value={metrics.responseRate} total={metrics.total} tone="blue" />
      <MetricChip label="OA" value={metrics.oaRate} total={metrics.total} tone="amber" />
      <MetricChip label="Int" value={metrics.interviewRate} total={metrics.total} tone="purple" />
      <MetricChip label="Off" value={metrics.offerRate} total={metrics.total} tone="emerald" />
    </div>
  );
}

/** Collapsed-by-default edit timeline. Footer-style strip on a resume card —
 *  shows the most recent entry inline, click-to-reveal expands the rest.
 *  Renders nothing when the resume has no version entries (legacy + never-
 *  mutated resumes alike). */
function VersionHistoryStrip({ versions }: { versions: ResumeVersion[] | undefined }) {
  const [open, setOpen] = useState(false);
  const list = versions ?? [];
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const newest = sorted[0];
  const rest = sorted.slice(1);
  return (
    <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-full flex items-center gap-1.5 text-left hover:text-foreground"
        aria-expanded={open}
        aria-label={`Toggle version history (${sorted.length} entr${sorted.length === 1 ? "y" : "ies"})`}
      >
        <ChevronRight size={11} strokeWidth={2} className={`transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
        <span className="font-semibold uppercase tracking-wider text-[10px]">History</span>
        <span className="tabular-nums">· {sorted.length}</span>
        {!open && (
          <span className="ml-2 truncate flex-1 min-w-0 italic">
            {fmtShort(newest.timestamp)} — {newest.summary || "Updated"}
          </span>
        )}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-4">
          <li className="flex items-baseline gap-2">
            <span className="text-foreground tabular-nums shrink-0">{fmtShort(newest.timestamp)}</span>
            <span className="text-muted-foreground italic">{newest.summary || "Updated"}</span>
          </li>
          {rest.map((v, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="tabular-nums shrink-0">{fmtShort(v.timestamp)}</span>
              <span className="italic">{v.summary || "Updated"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type TagColor = { bg: string; text: string; border: string };

const DEFAULT_TAG_COLOR: TagColor = {
  bg: "hsl(210 25% 93%)",
  text: "hsl(215 18% 32%)",
  border: "hsl(210 20% 73%)",
};

function hashTag(tag: string) {
  const normalized = tag.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildTagColorMap(tags: string[]): Record<string, TagColor> {
  const colorMap: Record<string, TagColor> = {};
  const usedSlots = new Set<string>();
  const bgLightness = [92, 88, 84, 80];
  const textLightness = [30, 26, 22, 18];
  const borderLightness = [70, 64, 58, 52];

  tags.forEach((tag) => {
    const seed = hashTag(tag);

    // Deterministically find an unused color slot so no two tags share a chip color.
    for (let step = 0; step < 360 * bgLightness.length; step += 1) {
      const hue = (seed + (step * 37)) % 360;
      const toneIdx = Math.floor(step / 360);
      const slotKey = `${hue}-${toneIdx}`;
      if (usedSlots.has(slotKey)) continue;

      usedSlots.add(slotKey);
      colorMap[tag] = {
        bg: `hsl(${hue} 85% ${bgLightness[toneIdx]}%)`,
        text: `hsl(${hue} 62% ${textLightness[toneIdx]}%)`,
        border: `hsl(${hue} 55% ${borderLightness[toneIdx]}%)`,
      };
      break;
    }

    if (!colorMap[tag]) colorMap[tag] = DEFAULT_TAG_COLOR;
  });

  return colorMap;
}

function getTagColor(tag: string, tagColorMap: Record<string, TagColor>) {
  return tagColorMap[tag] ?? DEFAULT_TAG_COLOR;
}

function ResumeCard({ r, isPrimary, tagColorMap, setAsPrimary, setEditing, setModal, handleDelete, setPreviewResume, parseWithAI, parsingId }: {
  r: Resume; isPrimary: boolean; tagColorMap: Record<string, TagColor>;
  setAsPrimary: (id: string | null) => void; setEditing: (r: Resume) => void; setModal: (v: boolean) => void;
  handleDelete: (id: string) => void; setPreviewResume: (r: Resume) => void;
  parseWithAI: (id: string) => void; parsingId: string | null;
}) {
  const isParsing = parsingId === r._id;
  return (
    <div className={`card-premium p-5 flex flex-col group ${isPrimary ? "ring-2 ring-emerald-500/50 border-emerald-500" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"}`}>
          <FileText size={20} strokeWidth={1.5} className={r.fileUrl ? "text-red-500" : "text-primary"} />
        </div>
        <div className="flex gap-1 opacity-100">
          <button
            onClick={() => r.fileUrl && setPreviewResume(r)}
            title={r.fileUrl ? "Preview PDF" : "No file to preview"}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border border-border ${
              r.fileUrl ? "text-muted-foreground hover:text-primary hover:border-primary" : "text-muted-foreground/50 cursor-not-allowed opacity-60"
            }`}
            disabled={!r.fileUrl}
          >
            <Eye size={14} strokeWidth={1.6} />
          </button>
          <button
            onClick={() => r.fileUrl && !isParsing && parseWithAI(r._id)}
            title={r.fileUrl ? "Update master profile from this resume" : "Upload a PDF first"}
            disabled={!r.fileUrl || isParsing}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border border-border ${
              r.fileUrl ? "text-muted-foreground hover:text-primary hover:border-primary" : "text-muted-foreground/50 cursor-not-allowed opacity-60"
            } ${isParsing ? "animate-pulse" : ""}`}
          >
            <RefreshCw size={14} strokeWidth={1.6} />
          </button>
          {isPrimary ? (
            <button onClick={() => setAsPrimary(null)} title="Remove as primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-emerald-500 hover:text-red-500 hover:border-red-400">
              <StarOff size={14} strokeWidth={1.8} fill="currentColor" />
            </button>
          ) : (
            <button onClick={() => setAsPrimary(r._id)} title="Set as primary for extension" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-400">
              <Star size={14} strokeWidth={1.5} />
            </button>
          )}
          <button onClick={() => { setEditing(r); setModal(true); }} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary"><Pencil size={14} strokeWidth={1.5} /></button>
          {!r.isProtected && (
            <button onClick={() => handleDelete(r._id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><Trash2 size={14} strokeWidth={1.5} /></button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h3 className="text-[15px] font-semibold text-foreground">{r.name}</h3>
        {isPrimary && <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">Primary</span>}
        {r.isProtected && <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded">Locked</span>}
      </div>
      {r.targetRole && <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1 w-fit">{r.targetRole}</span>}
      {r.tags && r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {r.tags.map((t, i) => {
            const c = getTagColor(t, tagColorMap);
            return (
              <span
                key={i}
                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border"
                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
              >
                {t}
              </span>
            );
          })}
        </div>
      )}
      {r.fileName && <span className="text-xs text-muted-foreground mb-1">{r.fileName}</span>}
      <MetricsStrip metrics={r.metrics} />
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Added {fmt(r.uploadDate)}</span>
          <span className="font-medium text-muted-foreground">{r.applicationCount || 0} apps</span>
        </div>
        <VersionHistoryStrip versions={r.versions} />
      </div>
    </div>
  );
}

function ResumeListRow({ r, isPrimary, tagColorMap, setAsPrimary, setEditing, setModal, handleDelete, setPreviewResume }: {
  r: Resume; isPrimary: boolean; tagColorMap: Record<string, TagColor>;
  setAsPrimary: (id: string | null) => void; setEditing: (r: Resume) => void; setModal: (v: boolean) => void;
  handleDelete: (id: string) => void; setPreviewResume: (r: Resume) => void;
}) {
  return (
    <div className={`card-premium p-3 flex items-center gap-3 ${isPrimary ? "ring-2 ring-emerald-500/50 border-emerald-500" : ""}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"}`}>
        <FileText size={18} strokeWidth={1.5} className={r.fileUrl ? "text-red-500" : "text-primary"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground truncate">{r.name}</h3>
          {isPrimary && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">Primary</span>}
          {r.targetRole && <span className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{r.targetRole}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{r.fileName || "No file"}</span>
          <span>•</span>
          <span>{r.applicationCount || 0} apps</span>
          <span>•</span>
          <span>Added {fmt(r.uploadDate)}</span>
        </div>
        {r.tags && r.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {r.tags.map((t, i) => {
              const c = getTagColor(t, tagColorMap);
              return (
                <span key={i} className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                  {t}
                </span>
              );
            })}
          </div>
        )}
        <MetricsStrip metrics={r.metrics} />
        <VersionHistoryStrip versions={r.versions} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => r.fileUrl && setPreviewResume(r)}
          title={r.fileUrl ? "Preview PDF" : "No file to preview"}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border border-border ${
            r.fileUrl ? "text-muted-foreground hover:text-primary hover:border-primary" : "text-muted-foreground/50 cursor-not-allowed opacity-60"
          }`}
          disabled={!r.fileUrl}
        >
          <Eye size={14} strokeWidth={1.6} />
        </button>
        {isPrimary ? (
          <button onClick={() => setAsPrimary(null)} title="Remove primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-emerald-500 hover:text-red-500 hover:border-red-400">
            <StarOff size={14} strokeWidth={1.8} fill="currentColor" />
          </button>
        ) : (
          <button onClick={() => setAsPrimary(r._id)} title="Set primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-400">
            <Star size={14} strokeWidth={1.5} />
          </button>
        )}
        <button onClick={() => { setEditing(r); setModal(true); }} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary"><Pencil size={14} strokeWidth={1.5} /></button>
        {!r.isProtected && (
          <button onClick={() => handleDelete(r._id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><Trash2 size={14} strokeWidth={1.5} /></button>
        )}
      </div>
    </div>
  );
}

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Resume | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [primaryResumeId, setPrimaryResumeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();
  const { startTask, tasks } = useBackgroundTasks();
  const { requireRealAccount } = useDemoGate();

  // Track per-resume parse state via the global task list — survives navigation.
  const parsingId = useMemo(() => {
    const t = tasks.find((x) => (x.kind === "resume_parse" || x.kind === "profile_sync") && x.status === "running");
    return t?.id?.startsWith("resume-parse:") ? t.id.slice("resume-parse:".length) : null;
  }, [tasks]);

  const parseWithAI = useCallback((resumeId: string, resumeName?: string) => {
    if (!requireRealAccount("Resume parsing")) return;
    startTask({
      id: `resume-parse:${resumeId}`,
      kind: "profile_sync",
      label: "Updating master profile",
      sublabel: resumeName,
      run: async ({ setRecovery }) => {
        await masterProfileAPI.parseFromResume(resumeId);
        // Backend flipped parseStatus to "processing"; survives refresh from here.
        setRecovery({ resourceId: "master" });
        return pollMasterProfileParse();
      },
      onResult: (p) => {
        const profile = p as { parseStatus: string; parseError?: string };
        if (profile.parseStatus === "failed") {
          return { successLabel: profile.parseError || "Parse failed." };
        }
        return { successLabel: "Profile updated", ctaLabel: "View", ctaPath: "/profile" };
      },
      onError: (err) => {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        return e?.response?.data?.error || e?.message || "Failed to extract. Check your AI key in Settings.";
      },
    });
  }, [startTask, requireRealAccount]);

  const fetchResumes = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([resumesAPI.getAll(), authAPI.getMe()]);
      setResumes(list);
      setPrimaryResumeId(me.primaryResumeId ?? null);
    } catch {
      try {
        setResumes(await resumesAPI.getAll());
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  // Auto-set primary when there's exactly 1 resume and no primary set
  useEffect(() => {
    if (!loading && resumes.length === 1 && !primaryResumeId) {
      setAsPrimary(resumes[0]._id);
    }
  }, [loading, resumes, primaryResumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (data: { name: string; targetRole: string; fileName: string; tags?: string[]; file: File | null }) => {
    if (editing) {
      await resumesAPI.update(editing._id, data);
      toast.success("Resume updated");
    } else {
      await resumesAPI.create(data);
      toast.success("Resume added");
    }
    setModal(false); setEditing(null); await fetchResumes();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This resume will be permanently deleted.", { title: "Delete resume?", confirmLabel: "Delete" });
    if (!ok) return;
    await resumesAPI.delete(id);
    if (primaryResumeId === id) setPrimaryResumeId(null);
    toast.success("Deleted");
    await fetchResumes();
  };

  const setAsPrimary = async (id: string | null) => {
    try {
      const me = await authAPI.updateProfile({ primaryResumeId: id });
      setPrimaryResumeId(me.primaryResumeId ?? null);
      toast.success(id ? "Primary resume saved — the extension will use it for new applications." : "Primary resume cleared.");
    } catch {
      toast.error("Could not update primary resume");
    }
  };

  // Sort resumes so primary is always first
  const sortedResumes = useMemo(() => {
    if (!primaryResumeId) return resumes;
    return [...resumes].sort((a, b) => {
      if (a._id === primaryResumeId) return -1;
      if (b._id === primaryResumeId) return 1;
      return 0;
    });
  }, [resumes, primaryResumeId]);

  /** A resume that was generated by the AI Tailor is tagged "tailored". We surface
   *  these in their own collapsible section so the main resume list stays clean. */
  const isTailored = (r: Resume) => (r.tags || []).includes("tailored");

  // Filter by search query (name, targetRole, or tags), then sort for faster scanning.
  // Tailored variants are excluded from the main list and surfaced separately below.
  const filteredResumes = useMemo(() => {
    const nonTailored = sortedResumes.filter((r) => !isTailored(r));
    const byTag = selectedTag === "All"
      ? nonTailored
      : nonTailored.filter((r) => r.tags?.includes(selectedTag));
    const q = search.trim().toLowerCase();
    const searched = !q ? byTag : byTag.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.targetRole.toLowerCase().includes(q)
      || r.tags?.some((t) => t.toLowerCase().includes(q))
    );
    return [...searched].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "usage") return (b.applicationCount || 0) - (a.applicationCount || 0);
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });
  }, [sortedResumes, search, selectedTag, sortBy]);

  /** Same search/sort but only over tailored variants. */
  const tailoredResumes = useMemo(() => {
    const tailored = resumes.filter(isTailored);
    const q = search.trim().toLowerCase();
    const searched = !q ? tailored : tailored.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.targetRole.toLowerCase().includes(q)
      || r.tags?.some((t) => t.toLowerCase().includes(q))
    );
    return [...searched].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }, [resumes, search]);

  // Collect all unique tags across resumes for autocomplete — exclude "tailored"
  // since it's a system tag, not something users assign by hand.
  const allExistingTags = useMemo(() => {
    const s = new Set<string>();
    resumes.forEach((r) => r.tags?.forEach((t) => { if (t !== "tailored") s.add(t); }));
    return Array.from(s).sort();
  }, [resumes]);
  const tagColorMap = useMemo(() => buildTagColorMap(allExistingTags), [allExistingTags]);
  const primaryResume = useMemo(() => filteredResumes.find((r) => r._id === primaryResumeId) ?? null, [filteredResumes, primaryResumeId]);
  const nonPrimaryResumes = useMemo(() => filteredResumes.filter((r) => r._id !== primaryResumeId), [filteredResumes, primaryResumeId]);

  useEffect(() => {
    if (selectedTag !== "All" && !allExistingTags.includes(selectedTag)) {
      setSelectedTag("All");
    }
  }, [selectedTag, allExistingTags]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a primary resume so the browser extension attaches it when you track a job.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
          <Plus size={16} strokeWidth={2} />Add resume
        </button>
      </div>

      {resumes.length > 0 && (
        <div className="sticky top-3 z-10 mb-6 px-1 py-1">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
              <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="input-premium !pl-9 w-[280px]"
                placeholder="Search by name, role, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} strokeWidth={2} />
                </button>
              )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`w-10 h-10 flex items-center justify-center ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={16} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`w-10 h-10 flex items-center justify-center border-l border-border ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="List view"
                    aria-label="List view"
                  >
                    <List size={16} strokeWidth={2} />
                  </button>
                </div>
                <ActionDropdown
                  align="right"
                  menuWidth="w-[180px]"
                  trigger={
                    <button className="input-premium h-10 text-[13px] w-[180px] flex items-center justify-between text-left">
                      <span>
                        {sortBy === "recent" ? "Most recent" : sortBy === "name" ? "Name A-Z" : "Most used"}
                      </span>
                      <ChevronDown size={14} strokeWidth={1.5} />
                    </button>
                  }
                  items={[
                    { label: "Most recent", onClick: () => setSortBy("recent"), className: sortBy === "recent" ? "text-primary font-medium" : undefined },
                    { label: "Name A-Z", onClick: () => setSortBy("name"), className: sortBy === "name" ? "text-primary font-medium" : undefined },
                    { label: "Most used", onClick: () => setSortBy("usage"), className: sortBy === "usage" ? "text-primary font-medium" : undefined },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {["All", ...allExistingTags].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border ${
                    selectedTag === tag
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {tag}
                  {tag !== "All" && (
                    <span className="text-[11px] bg-muted px-1.5 rounded-full">
                      {resumes.filter((r) => r.tags?.includes(tag)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {filteredResumes.length === 0 ? (
        resumes.length === 0 ? (
          <EmptyState
            intent="welcome"
            title="Add your first resume"
            description="Upload your résumés, tag them by role focus, and HireTrail will track which version actually gets responses. Mark one as Primary to power AI tailoring."
            actions={[
              { label: "Upload resume", variant: "primary", onClick: () => { setEditing(null); setModal(true); } },
            ]}
          />
        ) : (
          <EmptyState
            intent="filtered"
            title="No resumes match these filters"
            description="Try clearing your search or tag filter."
          />
        )
      ) : (
        <div className="space-y-4">
          {primaryResume && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    <Star size={12} fill="currentColor" strokeWidth={0} />
                    Primary Resume
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground truncate">{primaryResume.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{primaryResume.targetRole || "General purpose"} • {primaryResume.applicationCount || 0} apps</p>
                  <MetricsStrip metrics={primaryResume.metrics} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {primaryResume.fileUrl && (
                    <button onClick={() => setPreviewResume(primaryResume)} className="btn-secondary !h-9 !px-3 text-xs">Preview</button>
                  )}
                  {primaryResume.fileUrl && (
                    <button
                      onClick={() => parseWithAI(primaryResume._id, primaryResume.name)}
                      disabled={parsingId === primaryResume._id}
                      className="btn-secondary !h-9 !px-3 text-xs disabled:opacity-60"
                      title="Update master profile from this resume"
                    >
                      {parsingId === primaryResume._id ? "Parsing…" : "Sync to Profile"}
                    </button>
                  )}
                  <button onClick={() => { setEditing(primaryResume); setModal(true); }} className="btn-secondary !h-9 !px-3 text-xs">Edit</button>
                  <button onClick={() => setAsPrimary(null)} className="btn-secondary !h-9 !px-3 text-xs text-emerald-700 dark:text-emerald-300">Unset</button>
                </div>
              </div>
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nonPrimaryResumes.map((r) => <ResumeCard key={r._id} r={r} isPrimary={false} tagColorMap={tagColorMap} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} parseWithAI={parseWithAI} parsingId={parsingId} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {nonPrimaryResumes.map((r) => <ResumeListRow key={r._id} r={r} isPrimary={false} tagColorMap={tagColorMap} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />)}
            </div>
          )}

          {tailoredResumes.length > 0 && (
            <TailoredResumesSection
              resumes={tailoredResumes}
              allResumes={resumes}
              tagColorMap={tagColorMap}
              setEditing={setEditing}
              setModal={setModal}
              handleDelete={handleDelete}
              setPreviewResume={setPreviewResume}
            />
          )}
        </div>
      )}

      {previewResume && (
        <ResumePreview
          fileUrl={previewResume.fileUrl}
          name={previewResume.name}
          fileName={previewResume.fileName}
          onClose={() => setPreviewResume(null)}
        />
      )}
      {modal && <ResumeModal resume={editing} existingTags={allExistingTags} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

/* ---------- Tailored variants tree ----------
 * Groups tailored resumes by `baseResumeId` so the UI renders the lineage:
 *   <Base resume name>
 *     ↳ Tailored — Google / SWE
 *     ↳ Tailored — Stripe / Backend
 * Tailored resumes whose baseResumeId is null (hand-uploaded legacy or apps
 * that pre-date the lineage field) collect into an "Untraced" bucket. */

interface TailoredGroup {
  base: Resume | null;
  /** Display label for the group header. Mirrors `base.name` when present,
   *  falls back to "Untraced tailored resumes" otherwise. */
  label: string;
  children: Resume[];
}

function groupTailoredByBase(tailored: Resume[], allResumes: Resume[]): TailoredGroup[] {
  const baseById = new Map(allResumes.map((r) => [r._id, r] as const));
  const groups = new Map<string, TailoredGroup>();
  for (const r of tailored) {
    const baseId = r.baseResumeId || "__untraced__";
    if (!groups.has(baseId)) {
      const base = baseId === "__untraced__" ? null : (baseById.get(baseId) ?? null);
      groups.set(baseId, {
        base,
        label: base?.name ?? "Untraced tailored resumes",
        children: [],
      });
    }
    groups.get(baseId)!.children.push(r);
  }
  // Sort children newest first within each group; group order: known bases
  // by name asc, untraced last.
  for (const g of groups.values()) {
    g.children.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.base && b.base) return 1;
    if (a.base && !b.base) return -1;
    return a.label.localeCompare(b.label);
  });
}

function TailoredResumesSection({
  resumes, allResumes, tagColorMap, setEditing, setModal, handleDelete, setPreviewResume,
}: {
  resumes: Resume[];
  /** Full set of all resumes (incl. non-tailored) — needed to look up the
   *  base resume by id when building the tree. */
  allResumes: Resume[];
  tagColorMap: Record<string, TagColor>;
  setEditing: (r: Resume | null) => void;
  setModal: (b: boolean) => void;
  handleDelete: (id: string) => void;
  setPreviewResume: (r: Resume | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupTailoredByBase(resumes, allResumes), [resumes, allResumes]);
  return (
    <section className="mt-10 border-t border-border pt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-4 text-left w-full"
        aria-expanded={open}
      >
        <ChevronRight size={14} strokeWidth={2} className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tailored variants</h2>
          <p className="text-xs text-muted-foreground">
            {resumes.length} {resumes.length === 1 ? "version" : "versions"} grouped under their source resume.
          </p>
        </div>
      </button>
      {open && (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.base?._id ?? "__untraced__"} className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                <h3 className="text-sm font-semibold text-foreground truncate">{g.label}</h3>
                <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                  {g.children.length} variant{g.children.length === 1 ? "" : "s"}
                </span>
              </div>
              {/* Child list with the left-rail tree connector — a 2px primary
               *  bar runs down the gutter so the visual hierarchy reads even
               *  when bases are scrolled out of view. */}
              <div className="border-l-2 border-primary/30 pl-4 space-y-2">
                {g.children.map((r) => (
                  <ResumeListRow
                    key={r._id}
                    r={r}
                    isPrimary={false}
                    tagColorMap={tagColorMap}
                    setAsPrimary={() => {}}
                    setEditing={setEditing}
                    setModal={setModal}
                    handleDelete={handleDelete}
                    setPreviewResume={setPreviewResume}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
