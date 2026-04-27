/** Resume versions with optional PDF to Cloudinary; usage counts come from the list API. */
import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { resumesAPI, authAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import ResumeModal from "../../components/ResumeModal/ResumeModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Resume } from "../../types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

function ResumeCard({ r, isPrimary, tagColorMap, setAsPrimary, setEditing, setModal, handleDelete, setPreviewResume }: {
  r: Resume; isPrimary: boolean; tagColorMap: Record<string, TagColor>;
  setAsPrimary: (id: string | null) => void; setEditing: (r: Resume) => void; setModal: (v: boolean) => void;
  handleDelete: (id: string) => void; setPreviewResume: (r: Resume) => void;
}) {
  return (
    <div className={`card-premium p-5 flex flex-col group ${isPrimary ? "ring-2 ring-emerald-500/50 border-emerald-500" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"}`}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={r.fileUrl ? "text-red-500" : "text-primary"}>
            <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z"/><polyline points="12,2 12,7 17,7"/>
          </svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {isPrimary ? (
            <button onClick={() => setAsPrimary(null)} title="Remove as primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-emerald-500 hover:text-red-500 hover:border-red-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          ) : (
            <button onClick={() => setAsPrimary(r._id)} title="Set as primary for extension" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </button>
          )}
          <button onClick={() => { setEditing(r); setModal(true); }} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
          {!r.isProtected && (
            <button onClick={() => handleDelete(r._id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
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
      {r.fileName && <span className="text-xs text-muted-foreground mb-1">{r.fileName}</span>}
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Added {fmt(r.uploadDate)}</span>
          <span className="font-medium text-muted-foreground">{r.applicationCount || 0} apps</span>
        </div>
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
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={r.fileUrl ? "text-red-500" : "text-primary"}>
          <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z"/><polyline points="12,2 12,7 17,7"/>
        </svg>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        {isPrimary ? (
          <button onClick={() => setAsPrimary(null)} title="Remove primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-emerald-500 hover:text-red-500 hover:border-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
        ) : (
          <button onClick={() => setAsPrimary(r._id)} title="Set primary" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
        )}
        <button onClick={() => { setEditing(r); setModal(true); }} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
        {!r.isProtected && (
          <button onClick={() => handleDelete(r._id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
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

  // Filter by search query (name, targetRole, or tags), then sort for faster scanning.
  const filteredResumes = useMemo(() => {
    const byTag = selectedTag === "All"
      ? sortedResumes
      : sortedResumes.filter((r) => r.tags?.includes(selectedTag));
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

  // Collect all unique tags across resumes for autocomplete
  const allExistingTags = useMemo(() => {
    const s = new Set<string>();
    resumes.forEach((r) => r.tags?.forEach((t) => s.add(t)));
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a primary resume so the browser extension attaches it when you track a job.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>Add resume
        </button>
      </div>

      {resumes.length > 0 && (
        <div className="sticky top-3 z-10 mb-6 px-1 py-1">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="input-premium !pl-9 w-[280px]"
                placeholder="Search by name, role, or tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`w-10 h-10 flex items-center justify-center border-l border-border ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="List view"
                    aria-label="List view"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <circle cx="4" cy="6" r="1" />
                      <circle cx="4" cy="12" r="1" />
                      <circle cx="4" cy="18" r="1" />
                    </svg>
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
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <polyline points="4,6 8,10 12,6" />
                      </svg>
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
        <div className="card-premium p-12 text-center text-muted-foreground">
          {resumes.length === 0 ? (
            <><h3 className="font-medium text-muted-foreground mb-1">No resumes yet</h3><p className="text-sm">Add your resume versions to track which performs best</p></>
          ) : (
            <><h3 className="font-medium text-muted-foreground mb-1">No matches</h3><p className="text-sm">No resumes match your current search and tag filter.</p></>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {primaryResume && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Primary Resume
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground truncate">{primaryResume.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{primaryResume.targetRole || "General purpose"} • {primaryResume.applicationCount || 0} apps</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {primaryResume.fileUrl && (
                    <button onClick={() => setPreviewResume(primaryResume)} className="btn-secondary !h-9 !px-3 text-xs">Preview</button>
                  )}
                  <button onClick={() => { setEditing(primaryResume); setModal(true); }} className="btn-secondary !h-9 !px-3 text-xs">Edit</button>
                  <button onClick={() => setAsPrimary(null)} className="btn-secondary !h-9 !px-3 text-xs text-emerald-700 dark:text-emerald-300">Unset</button>
                </div>
              </div>
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nonPrimaryResumes.map((r) => <ResumeCard key={r._id} r={r} isPrimary={false} tagColorMap={tagColorMap} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {nonPrimaryResumes.map((r) => <ResumeListRow key={r._id} r={r} isPrimary={false} tagColorMap={tagColorMap} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />)}
            </div>
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
