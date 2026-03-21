import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import toast from "react-hot-toast";
import { applicationsAPI, resumesAPI } from "../../utils/api.ts";
import { exportToCSV } from "../../utils/csv.ts";
import ImportModal from "../../components/ImportModal/ImportModal.tsx";
import { SkeletonTable, SkeletonStats } from "../../components/Skeleton/Skeleton.tsx";
import type { Application, Resume, Stage, ApplicationFormData, Pagination, SortConfig } from "../../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];
const badgeCls: Record<Stage, string> = { Applied: "bg-accent-light text-accent-dark", OA: "bg-warning-light text-yellow-800", Interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", Offer: "bg-success-light text-emerald-800", Rejected: "bg-danger-light text-red-800" };
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function SortArrow({ field, sort }: { field: string; sort: SortConfig }) {
  const active = sort.field === field;
  return (
    <span className={`inline-flex flex-col ml-1 leading-none ${active ? "text-accent" : "text-gray-300 dark:text-gray-600"}`}>
      <svg width="8" height="5" viewBox="0 0 8 5" className={active && sort.order === "asc" ? "text-accent" : ""}><path d="M4 0L8 5H0L4 0Z" fill="currentColor" /></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" className={`mt-[1px] ${active && sort.order === "desc" ? "text-accent" : ""}`}><path d="M4 5L0 0H8L4 5Z" fill="currentColor" /></svg>
    </span>
  );
}

function Modal({ app, resumes, onSave, onClose }: { app: Application | null; resumes: Resume[]; onSave: (d: ApplicationFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<ApplicationFormData>({ company: app?.company || "", role: app?.role || "", jobUrl: app?.jobUrl || "", stage: app?.stage || "Applied", notes: app?.notes || "", resumeId: app?.resumeId || "" });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{app ? "Edit application" : "New application"}</h2><button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Company *</label><input className="input-premium" value={form.company} onChange={(e) => u("company", e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Role *</label><input className="input-premium" value={form.role} onChange={(e) => u("role", e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Job URL</label><input type="url" className="input-premium" value={form.jobUrl} onChange={(e) => u("jobUrl", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Stage</label><select className="input-premium" value={form.stage} onChange={(e) => u("stage", e.target.value)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Resume</label><select className="input-premium" value={form.resumeId} onChange={(e) => u("resumeId", e.target.value)}><option value="">None</option>{resumes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}</select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Notes</label><textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "Saving..." : app ? "Update" : "Add application"}</button></div>
        </form>
      </div>
    </div>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">Showing {(pag.page - 1) * pag.limit + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">Prev</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 text-sm rounded-lg transition-colors ${p === page ? "bg-accent text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>{p}</button>;
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">Next</button>
      </div>
    </div>
  );
}

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [sort, setSort] = useState<SortConfig>({ field: "createdAt", order: "desc" });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search — 300ms
  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        applicationsAPI.getAll({ page, limit: 25, sort: sort.field, order: sort.order, search: debouncedSearch || undefined }),
        resumesAPI.getAll(),
      ]);
      setApps(a.data); setPag(a.pagination); setResumes(r);
    } catch {} finally { setLoading(false); }
  }, [page, sort, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    try {
      toast.loading("Preparing export...", { id: "export" });
      const res = await applicationsAPI.getAll({ limit: 999 });
      exportToCSV(res.data);
      toast.success(`Exported ${res.data.length} applications`, { id: "export" });
    } catch { toast.error("Export failed", { id: "export" }); }
  };

  const handleSave = async (d: ApplicationFormData) => {
    if (editing) { await applicationsAPI.update(editing._id, d); toast.success("Updated"); }
    else { await applicationsAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchData();
  };

  const handleDelete = async (id: string) => { if (!confirm("Delete this application?")) return; await applicationsAPI.delete(id); toast.success("Deleted"); await fetchData(); };
  const toggleSort = (field: string) => { setSort((s) => ({ field, order: s.field === field && s.order === "desc" ? "asc" : "desc" })); setPage(1); };

  // Client-side stage filter on server-returned data
  const filtered = filter === "All" ? apps : apps.filter((a) => a.stage === filter);
  // Stage counts from full page data
  const stageCounts = STAGES.reduce((acc, s) => { acc[s] = apps.filter((a) => a.stage === s).length; return acc; }, {} as Record<string, number>);

  if (loading) return <div className="fade-up"><SkeletonStats /><SkeletonTable rows={8} /></div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Applications</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportModal(true)} className="btn-secondary" title="Import CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import
          </button>
          <button onClick={handleExport} className="btn-secondary" title="Export CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export
          </button>
          <button onClick={() => { setEditing(null); setModal(true); }} className="btn-accent">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>Add application
          </button>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-[49px] z-20 bg-page/95 dark:bg-gray-900/95 backdrop-blur-sm py-3 -mx-8 px-8">
        <div className="flex flex-wrap items-center gap-4 max-w-[1200px]">
          <input className="input-premium max-w-[280px]" placeholder="Search company or role..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {["All", ...STAGES].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border transition-all ${filter === s ? "bg-accent-light border-accent text-accent-dark dark:bg-accent/20 dark:border-accent dark:text-accent" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-accent hover:text-accent"}`}>
                {s}{s !== "All" && <span className="text-[11px] bg-gray-100 dark:bg-gray-700 px-1.5 rounded-full">{stageCounts[s] || 0}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium p-12 text-center text-gray-400">
          <h3 className="font-medium text-gray-500 mb-1">No applications found</h3>
          <p className="text-sm">{search || filter !== "All" ? "Try adjusting filters" : "Add your first application"}</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                {[{ l: "Company", f: "company" }, { l: "Role", f: "role" }, { l: "Stage", f: "stage" }, { l: "Resume", f: "" }, { l: "Applied", f: "applicationDate" }].map((h) => (
                  <th key={h.l} className={`text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-4 py-3 ${h.f ? "cursor-pointer hover:text-accent select-none" : ""}`} onClick={() => h.f && toggleSort(h.f)}>
                    <span className="inline-flex items-center">{h.l}{h.f && <SortArrow field={h.f} sort={sort} />}</span>
                  </th>
                ))}
                <th className="w-20 px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((a) => (
                  <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-3"><span className="text-sm font-medium text-gray-900 dark:text-white">{a.company}</span>{a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-gray-300 hover:text-accent inline-flex opacity-0 group-hover:opacity-100 transition-opacity"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 6.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h3"/><polyline points="7,1.5 10.5,1.5 10.5,5"/><line x1="5.5" y1="6.5" x2="10.5" y2="1.5"/></svg></a>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{a.role}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${badgeCls[a.stage]}`}>{a.stage}</span></td>
                    <td className="px-4 py-3 text-[13px] text-gray-400">{resumes.find((r) => r._id === a.resumeId)?.name || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-400">{fmt(a.applicationDate)}</td>
                    <td className="px-4 py-3"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(a); setModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-accent hover:border-accent transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
                      <button onClick={() => handleDelete(a._id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-danger hover:border-danger transition-colors"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </div>
      )}

      {modal && <Modal app={editing} resumes={resumes} onSave={handleSave} onClose={() => { setModal(false); setEditing(null); }} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onImported={fetchData} />}
    </div>
  );
}
