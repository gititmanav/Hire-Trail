/** Resume versions with optional PDF to Cloudinary; usage counts come from the list API. */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, Eye, FileText, Pencil, Plus, RefreshCw, Search, Sparkles,
  Star, StarOff, Trash2, Upload, UserRound, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { resumesAPI, authAPI, masterProfileAPI, pollMasterProfileParse } from "../../utils/api.ts";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
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

/** Newest version timestamp = "last edited"; falls back to upload date for
 *  resumes that pre-date the versions[] feature. */
function lastEditedAt(r: Resume): string {
  const vs = r.versions ?? [];
  if (vs.length === 0) return r.uploadDate;
  return vs.reduce((latest, v) => (new Date(v.timestamp) > new Date(latest) ? v.timestamp : latest), vs[0].timestamp);
}

/** Performance metrics strip — single row of percentage chips driven by the
 *  backend's per-resume aggregate (response / OA / interview / offer rates).
 *  Renders nothing when the resume has no submitted apps. */
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

/** Collapsed-by-default edit timeline. Shows the most recent entry inline,
 *  click-to-reveal expands the rest. Renders nothing when there are no entries. */
function VersionHistoryStrip({ versions }: { versions: ResumeVersion[] | undefined }) {
  const [open, setOpen] = useState(false);
  const list = versions ?? [];
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const newest = sorted[0];
  const rest = sorted.slice(1);
  return (
    <div className="mt-1.5 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="flex items-center gap-1.5 text-left hover:text-foreground"
        aria-expanded={open}
        aria-label={`Toggle version history (${sorted.length} entr${sorted.length === 1 ? "y" : "ies"})`}
      >
        <ChevronRight size={11} strokeWidth={2} className={`transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
        <span className="font-semibold uppercase tracking-wider text-[10px]">History</span>
        <span className="tabular-nums">· {sorted.length}</span>
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

function TagChips({ tags, tagColorMap }: { tags: string[] | undefined; tagColorMap: Record<string, TagColor> }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map((t, i) => {
        const c = getTagColor(t, tagColorMap);
        return (
          <span key={i} className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
            {t}
          </span>
        );
      })}
    </div>
  );
}

/** Status pills: Primary / Locked / Uploaded vs Generated. */
function StatusBadges({ r, isPrimary }: { r: Resume; isPrimary: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {r.fileUrl
        ? <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">Uploaded</span>
        : <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">Generated</span>}
      {isPrimary && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Star size={9} fill="currentColor" strokeWidth={0} />Primary</span>}
      {r.isProtected && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">Locked</span>}
    </div>
  );
}

/* ---------- Document table row ---------- */

function ResumeTableRow({ r, isPrimary, tagColorMap, selected, onToggleSelect, setAsPrimary, setEditing, setModal, handleDelete, setPreviewResume, parseWithAI, parsingId }: {
  r: Resume; isPrimary: boolean; tagColorMap: Record<string, TagColor>;
  selected: boolean; onToggleSelect: (id: string) => void;
  setAsPrimary: (id: string | null) => void; setEditing: (r: Resume) => void; setModal: (v: boolean) => void;
  handleDelete: (id: string) => void; setPreviewResume: (r: Resume) => void;
  parseWithAI: (id: string, name?: string) => void; parsingId: string | null;
}) {
  const isParsing = parsingId === r._id;
  const menuItems = [
    ...(r.fileUrl ? [{ label: "Preview PDF", icon: <Eye size={14} strokeWidth={1.6} />, onClick: () => setPreviewResume(r) }] : []),
    isPrimary
      ? { label: "Remove as primary", icon: <StarOff size={14} strokeWidth={1.6} />, onClick: () => setAsPrimary(null) }
      : { label: "Set as primary", icon: <Star size={14} strokeWidth={1.6} />, onClick: () => setAsPrimary(r._id) },
    ...(r.fileUrl ? [{ label: isParsing ? "Syncing…" : "Sync to profile", icon: <RefreshCw size={14} strokeWidth={1.6} className={isParsing ? "animate-pulse" : ""} />, onClick: () => !isParsing && parseWithAI(r._id, r.name), disabled: isParsing }] : []),
    ...(!r.isProtected ? [{ label: "Delete", icon: <Trash2 size={14} strokeWidth={1.6} />, onClick: () => handleDelete(r._id), className: "text-danger", divider: true }] : []),
  ];
  return (
    <tr className={`group transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}>
      <td className="w-10 pl-4 pr-1 align-top py-4">
        <input
          type="checkbox"
          checked={selected}
          disabled={r.isProtected}
          onChange={() => onToggleSelect(r._id)}
          aria-label={`Select ${r.name}`}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={r.isProtected ? "Protected resume can't be deleted" : undefined}
        />
      </td>
      <td className="py-4 pr-4 align-top min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"}`}>
            <FileText size={17} strokeWidth={1.5} className={r.fileUrl ? "text-red-500" : "text-primary"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <StatusBadges r={r} isPrimary={isPrimary} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {r.targetRole && <span className="text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{r.targetRole}</span>}
              {r.fileName && <span className="text-xs text-muted-foreground truncate">{r.fileName}</span>}
              <span className="text-xs text-muted-foreground">· {r.applicationCount || 0} app{r.applicationCount === 1 ? "" : "s"}</span>
            </div>
            <TagChips tags={r.tags} tagColorMap={tagColorMap} />
            <MetricsStrip metrics={r.metrics} />
            <VersionHistoryStrip versions={r.versions} />
          </div>
        </div>
      </td>
      <td className="py-4 px-3 align-top text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">{fmt(r.uploadDate)}</td>
      <td className="py-4 px-3 align-top text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">{fmt(lastEditedAt(r))}</td>
      <td className="py-4 pr-4 pl-3 align-top text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => { setEditing(r); setModal(true); }}
            className="inline-flex items-center gap-1 px-2 py-1 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-md"
          >
            <Pencil size={13} strokeWidth={1.8} />Edit
          </button>
          <span className="text-border" aria-hidden>|</span>
          <ActionDropdown align="right" menuWidth="w-52" triggerLabel="More" triggerClassName="px-2 py-1 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-md" items={menuItems} />
        </div>
      </td>
    </tr>
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
        <TagChips tags={r.tags} tagColorMap={tagColorMap} />
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

/* ---------- Quick-action launcher card ---------- */

function ActionCard({ icon, title, subtitle, tone, onClick }: { icon: React.ReactNode; title: string; subtitle: string; tone: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{subtitle}</p>
      </div>
      <Plus size={16} strokeWidth={2} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

export default function Resumes() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Resume | null>(null);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [primaryResumeId, setPrimaryResumeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
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

  /** A resume generated by the AI Tailor is tagged "tailored". Surfaced in its
   *  own collapsible section so the main table stays clean. */
  const isTailored = (r: Resume) => (r.tags || []).includes("tailored");

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

  // Unique tags for the filter — exclude the system "tailored" tag.
  const allExistingTags = useMemo(() => {
    const s = new Set<string>();
    resumes.forEach((r) => r.tags?.forEach((t) => { if (t !== "tailored") s.add(t); }));
    return Array.from(s).sort();
  }, [resumes]);
  const tagColorMap = useMemo(() => buildTagColorMap(allExistingTags), [allExistingTags]);

  // Primary first, then the rest in the chosen sort order.
  const primaryResume = useMemo(() => filteredResumes.find((r) => r._id === primaryResumeId) ?? null, [filteredResumes, primaryResumeId]);
  const orderedRows = useMemo(() => {
    if (!primaryResume) return filteredResumes;
    return [primaryResume, ...filteredResumes.filter((r) => r._id !== primaryResumeId)];
  }, [filteredResumes, primaryResume, primaryResumeId]);

  useEffect(() => {
    if (selectedTag !== "All" && !allExistingTags.includes(selectedTag)) {
      setSelectedTag("All");
    }
  }, [selectedTag, allExistingTags]);

  // Selection — only non-protected resumes are selectable (protected can't be deleted).
  const selectableIds = useMemo(() => orderedRows.filter((r) => !r.isProtected).map((r) => r._id), [orderedRows]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => (selectableIds.every((id) => prev.has(id)) ? new Set() : new Set(selectableIds)));
  }, [selectableIds]);

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirmDelete(
      `${ids.length} resume${ids.length === 1 ? "" : "s"} will be permanently deleted. This can't be undone.`,
      { title: `Delete ${ids.length} resume${ids.length === 1 ? "" : "s"}?`, confirmLabel: "Delete", danger: true },
    );
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => resumesAPI.delete(id)));
      if (primaryResumeId && ids.includes(primaryResumeId)) setPrimaryResumeId(null);
      toast.success(`Deleted ${ids.length} resume${ids.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't delete some resumes — try again.");
    } finally {
      setSelected(new Set());
      await fetchResumes();
    }
  };

  const tagFilterLabel = selectedTag === "All" ? "All tags" : selectedTag;
  const sortLabel = sortBy === "recent" ? "Most recent" : sortBy === "name" ? "Name A–Z" : "Most used";

  return (
    <div className="fade-up max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage, tailor, and track every resume in your job search.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <ActionCard
          icon={<FileText size={20} strokeWidth={1.6} className="text-primary" />}
          title="New Resume"
          subtitle="Upload a PDF or add a version to track"
          tone="bg-primary/10"
          onClick={() => { setEditing(null); setModal(true); }}
        />
        <ActionCard
          icon={<Sparkles size={20} strokeWidth={1.6} className="text-violet-500" />}
          title="Tailor with AI"
          subtitle="Optimize a resume against a job description"
          tone="bg-violet-500/10"
          onClick={() => navigate("/tailor")}
        />
        <ActionCard
          icon={<UserRound size={20} strokeWidth={1.6} className="text-sky-500" />}
          title="Master Profile"
          subtitle="Edit the career history AI tailoring draws from"
          tone="bg-sky-500/10"
          onClick={() => navigate("/profile")}
        />
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 !rounded-lg" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
            </div>
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          intent="welcome"
          title="Add your first resume"
          description="Upload your résumés, tag them by role focus, and HireTrail will track which version actually gets responses. Mark one as Primary to power AI tailoring."
          actions={[{ label: "Upload resume", variant: "primary", onClick: () => { setEditing(null); setModal(true); } }]}
        />
      ) : (
        <>
          {/* ===== Resumes table card ===== */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                {selected.size > 0 ? (
                  <>
                    <span className="text-sm font-medium text-foreground tabular-nums">{selected.size} selected</span>
                    <span className="text-border" aria-hidden>|</span>
                    <button onClick={bulkDelete} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium text-danger hover:bg-danger/10 rounded-md">
                      <Trash2 size={14} strokeWidth={1.8} />Delete
                    </button>
                  </>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">{orderedRows.length} resume{orderedRows.length === 1 ? "" : "s"}</span>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium border border-border rounded-lg text-foreground hover:border-primary hover:text-primary transition-colors">
                  <Upload size={15} strokeWidth={1.8} />Upload
                </button>
                {allExistingTags.length > 0 && (
                  <ActionDropdown
                    align="right"
                    menuWidth="w-52"
                    searchable={allExistingTags.length > 6}
                    searchPlaceholder="Filter tags…"
                    trigger={
                      <button className="inline-flex items-center justify-between gap-2 h-9 px-3 text-sm border border-border rounded-lg text-foreground hover:border-muted-foreground/40 min-w-[120px]">
                        <span className="truncate">{tagFilterLabel}</span>
                        <ChevronRight size={14} strokeWidth={1.8} className="rotate-90 text-muted-foreground shrink-0" />
                      </button>
                    }
                    items={[
                      { label: "All tags", onClick: () => setSelectedTag("All"), className: selectedTag === "All" ? "text-primary font-medium" : undefined },
                      ...allExistingTags.map((t) => ({ label: t, onClick: () => setSelectedTag(t), className: selectedTag === t ? "text-primary font-medium" : undefined })),
                    ]}
                  />
                )}
                <ActionDropdown
                  align="right"
                  menuWidth="w-44"
                  trigger={
                    <button className="inline-flex items-center justify-between gap-2 h-9 px-3 text-sm border border-border rounded-lg text-foreground hover:border-muted-foreground/40 min-w-[130px]">
                      <span className="truncate">{sortLabel}</span>
                      <ChevronRight size={14} strokeWidth={1.8} className="rotate-90 text-muted-foreground shrink-0" />
                    </button>
                  }
                  items={[
                    { label: "Most recent", onClick: () => setSortBy("recent"), className: sortBy === "recent" ? "text-primary font-medium" : undefined },
                    { label: "Name A–Z", onClick: () => setSortBy("name"), className: sortBy === "name" ? "text-primary font-medium" : undefined },
                    { label: "Most used", onClick: () => setSortBy("usage"), className: sortBy === "usage" ? "text-primary font-medium" : undefined },
                  ]}
                />
                <div className="relative">
                  <Search size={15} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    className="h-9 w-full sm:w-56 pl-9 pr-8 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    placeholder="Search resumes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            {orderedRows.length === 0 ? (
              <div className="px-6 py-12">
                <EmptyState intent="filtered" title="No resumes match these filters" description="Try clearing your search or tag filter." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="w-10 pl-4 pr-1 py-2.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all resumes"
                          disabled={selectableIds.length === 0}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-ring disabled:opacity-40 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 pr-4">Resume name</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Created</th>
                      <th className="py-2.5 px-3 hidden lg:table-cell">Last edited</th>
                      <th className="py-2.5 pr-4 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orderedRows.map((r) => (
                      <ResumeTableRow
                        key={r._id}
                        r={r}
                        isPrimary={r._id === primaryResumeId}
                        tagColorMap={tagColorMap}
                        selected={selected.has(r._id)}
                        onToggleSelect={toggleSelect}
                        setAsPrimary={setAsPrimary}
                        setEditing={setEditing}
                        setModal={setModal}
                        handleDelete={handleDelete}
                        setPreviewResume={setPreviewResume}
                        parseWithAI={parseWithAI}
                        parsingId={parsingId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
        </>
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
    <section className="mt-8 border-t border-border pt-6">
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
