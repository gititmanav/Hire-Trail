/** Resume versions with optional PDF to Cloudinary; usage counts come from the list API. */
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import toast from "react-hot-toast";
import { resumesAPI, authAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Resume } from "../../types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Modal({ resume, onSave, onClose }: { resume: Resume | null; onSave: (data: { name: string; targetRole: string; fileName: string; file: File | null }) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(resume?.name || "");
  const [targetRole, setTargetRole] = useState(resume?.targetRole || "");
  const [fileName, setFileName] = useState(resume?.fileName || "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") { setFile(f); if (!fileName) setFileName(f.name); }
    else toast.error("Only PDF files are allowed");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!fileName) setFileName(f.name); }
  };

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{resume ? "Edit resume" : "New resume version"}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button>
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave({ name, targetRole, fileName, file }).catch(() => setSaving(false)); }} className="space-y-4">
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Version name *</label><input className="input-premium" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SWE Resume v2" required /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Target role</label><input className="input-premium" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Software Engineer" /></div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">PDF file <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger shrink-0"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><polyline points="13,2 13,9 20,9"/></svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-muted-foreground hover:text-danger ml-2">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
                  </button>
                </div>
              ) : resume?.fileUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                  <p className="text-sm text-secondary-foreground">File uploaded — click to replace</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-2 text-muted-foreground dark:text-secondary-foreground" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="text-sm text-muted-foreground">Drop PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "Saving..." : resume ? "Update" : "Add resume"}</button>
          </div>
        </form>
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

  const save = async (data: { name: string; targetRole: string; fileName: string; file: File | null }) => {
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

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a primary resume so the browser extension attaches it when you track a job.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>Add resume
        </button>
      </div>

      {resumes.length === 0 ? (
        <div className="card-premium p-12 text-center text-muted-foreground"><h3 className="font-medium text-muted-foreground mb-1">No resumes yet</h3><p className="text-sm">Add your resume versions to track which performs best</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((r) => (
            <div key={r._id} className="card-premium p-5 flex flex-col group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"}`}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={r.fileUrl ? "text-red-500" : "text-primary"}>
                    <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z"/><polyline points="12,2 12,7 17,7"/>
                  </svg>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(r); setModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
                  <button onClick={() => handleDelete(r._id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-[15px] font-semibold text-foreground">{r.name}</h3>
                {primaryResumeId === r._id && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded">Primary</span>
                )}
              </div>
              {r.targetRole && <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1 w-fit">{r.targetRole}</span>}
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

              <div className="mt-auto pt-3 border-t border-border space-y-2">
                {primaryResumeId === r._id ? (
                  <button type="button" onClick={() => setAsPrimary(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Remove as primary
                  </button>
                ) : (
                  <button type="button" onClick={() => setAsPrimary(r._id)} className="text-xs font-medium text-primary hover:underline">
                    Set as primary for extension
                  </button>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Added {fmt(r.uploadDate)}</span>
                  <span className="font-medium text-muted-foreground">{r.applicationCount || 0} apps</span>
                </div>
              </div>
            </div>
          ))}
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
      {modal && <Modal resume={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
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
