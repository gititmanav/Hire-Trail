import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import toast from "react-hot-toast";
import { resumesAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{resume ? "Edit resume" : "New resume version"}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button>
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave({ name, targetRole, fileName, file }).catch(() => setSaving(false)); }} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Version name *</label><input className="input-premium" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SWE Resume v2" required /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Target role</label><input className="input-premium" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Software Engineer" /></div>

          {/* File upload zone */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">PDF file <span className="text-gray-400 font-normal">(optional)</span></label>
            <div
              className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-accent transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger shrink-0"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><polyline points="13,2 13,9 20,9"/></svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-gray-400 hover:text-danger ml-2">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
                  </button>
                </div>
              ) : resume?.fileUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                  <p className="text-sm text-gray-600 dark:text-gray-300">File uploaded — click to replace</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-2 text-gray-300 dark:text-gray-600" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drop PDF here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
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
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchResumes = useCallback(async () => { try { setResumes(await resumesAPI.getAll()); } catch {} finally { setLoading(false); } }, []);
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
    toast.success("Deleted");
    await fetchResumes();
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Resumes</h1>
        <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>Add resume
        </button>
      </div>

      {resumes.length === 0 ? (
        <div className="card-premium p-12 text-center text-gray-400"><h3 className="font-medium text-gray-500 mb-1">No resumes yet</h3><p className="text-sm">Add your resume versions to track which performs best</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((r) => (
            <div key={r._id} className="card-premium p-5 flex flex-col group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.fileUrl ? "bg-red-100 dark:bg-red-900/30" : "bg-accent-light dark:bg-accent/20"}`}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={r.fileUrl ? "text-red-500" : "text-accent"}>
                    <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z"/><polyline points="12,2 12,7 17,7"/>
                  </svg>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(r); setModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-accent hover:border-accent transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
                  <button onClick={() => handleDelete(r._id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-danger hover:border-danger transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
                </div>
              </div>

              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">{r.name}</h3>
              {r.targetRole && <span className="inline-block text-xs font-medium text-accent-dark dark:text-accent bg-accent-light dark:bg-accent/20 px-2 py-0.5 rounded-full mb-1 w-fit">{r.targetRole}</span>}
              {r.fileName && <span className="text-xs text-gray-400 mb-1">{r.fileName}</span>}

              {/* PDF link */}
              {r.fileUrl && (
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline mt-1 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  View PDF
                </a>
              )}

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                <span>Added {fmt(r.uploadDate)}</span>
                <span className="font-medium text-gray-500 dark:text-gray-300">{r.applicationCount || 0} apps</span>
              </div>
            </div>
          ))}
        </div>
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
