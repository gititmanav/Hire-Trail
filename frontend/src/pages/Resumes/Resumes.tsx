/** Resume versions with optional PDF to Cloudinary; usage counts come from the list API. */
import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { resumesAPI, authAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import ResumeModal from "../../components/ResumeModal/ResumeModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Resume } from "../../types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Rotating tag colors — derived from stage palette
const TAG_COLORS = [
  { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },                                             // blue
  { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" }, // purple
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },      // yellow/amber
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" }, // green
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-700" },             // red/rose
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" },             // cyan
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" }, // orange
];

function getTagColor(tag: string, allTags: string[]) {
  const idx = allTags.indexOf(tag);
  return TAG_COLORS[idx >= 0 ? idx % TAG_COLORS.length : 0];
}

function ResumeCard({ r, isPrimary, allTags, setAsPrimary, setEditing, setModal, handleDelete, setPreviewResume }: {
  r: Resume; isPrimary: boolean; allTags: string[];
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          {r.tags.map((t, i) => { const c = getTagColor(t, allTags); return <span key={i} className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{t}</span>; })}
        </div>
      )}
      {r.fileName && <span className="text-xs text-muted-foreground mb-1">{r.fileName}</span>}
      {r.fileUrl ? (
        <button onClick={() => setPreviewResume(r)} className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline mt-1 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          View PDF
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground dark:text-secondary-foreground mt-1 mb-1 cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><polyline points="13,2 13,9 20,9"/></svg>
          No file
        </span>
      )}
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Added {fmt(r.uploadDate)}</span>
          <span className="font-medium text-muted-foreground">{r.applicationCount || 0} apps</span>
        </div>
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

  // Filter by search query (name, targetRole, or tags)
  const filteredResumes = useMemo(() => {
    const byTag = selectedTag === "All"
      ? sortedResumes
      : sortedResumes.filter((r) => r.tags?.includes(selectedTag));
    const q = search.trim().toLowerCase();
    if (!q) return byTag;
    return byTag.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.targetRole.toLowerCase().includes(q)
      || r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [sortedResumes, search, selectedTag]);

  // Group resumes by tag — a resume can appear in multiple groups
  // Primary resume's group(s) float to the top
  const tagGroups = useMemo(() => {
    const groups: { tag: string; resumes: Resume[] }[] = [];
    const tagSet = new Set<string>();
    const untagged: Resume[] = [];

    filteredResumes.forEach((r) => {
      if (!r.tags || r.tags.length === 0) { untagged.push(r); return; }
      r.tags.forEach((t) => tagSet.add(t));
    });

    // Build ordered groups — primary resume's tag groups first
    const primaryTags = new Set(filteredResumes.find((r) => r._id === primaryResumeId)?.tags || []);
    const allTags = Array.from(tagSet).sort();
    const priorityTags = allTags.filter((t) => primaryTags.has(t));
    const otherTags = allTags.filter((t) => !primaryTags.has(t));

    [...priorityTags, ...otherTags].forEach((tag) => {
      const grouped = filteredResumes.filter((r) => r.tags?.includes(tag));
      groups.push({ tag, resumes: grouped });
    });
    if (untagged.length > 0) groups.push({ tag: "", resumes: untagged });

    return groups;
  }, [filteredResumes, primaryResumeId]);

  const hasAnyTags = tagGroups.length > 1 || (tagGroups.length === 1 && tagGroups[0].tag !== "");

  // Collect all unique tags across resumes for autocomplete
  const allExistingTags = useMemo(() => {
    const s = new Set<string>();
    resumes.forEach((r) => r.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [resumes]);

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
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
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
      ) : hasAnyTags ? (
        /* ── Grouped by tag, with primary pinned on top ── */
        <div className="space-y-6">
          {/* Primary resume — pinned above all groups */}
          {primaryResumeId && (() => {
            const pr = filteredResumes.find((r) => r._id === primaryResumeId);
            if (!pr) return null;
            return (
              <div className="border border-emerald-300 dark:border-emerald-700 rounded-xl p-4 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Primary Resume
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ResumeCard r={pr} isPrimary allTags={allExistingTags} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />
                </div>
              </div>
            );
          })()}

          {/* Tag groups — excluding primary from inside them */}
          {tagGroups.map((g) => {
            const groupResumes = g.resumes.filter((r) => r._id !== primaryResumeId);
            if (groupResumes.length === 0) return null;
            const tc = g.tag ? getTagColor(g.tag, allExistingTags) : null;
            return (
            <div key={g.tag || "__untagged"} className={`border rounded-xl p-4 ${tc ? tc.border : "border-border"}`}>
              <div className="flex items-center gap-2 mb-3">
                {tc ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${tc.bg} ${tc.text}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    {g.tag}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Untagged</span>
                )}
                <span className="text-[11px] text-muted-foreground">{groupResumes.length} resume{groupResumes.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupResumes.map((r) => <ResumeCard key={r._id} r={r} isPrimary={false} allTags={allExistingTags} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />)}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat grid (no tags) — primary first ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResumes.map((r) => <ResumeCard key={r._id} r={r} isPrimary={primaryResumeId === r._id} allTags={allExistingTags} setAsPrimary={setAsPrimary} setEditing={setEditing} setModal={setModal} handleDelete={handleDelete} setPreviewResume={setPreviewResume} />)}
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
