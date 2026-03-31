/** Companies page: card grid with search, filter, and CRUD modal. */
import { useState, useEffect, useCallback, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { companiesAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Company, CompanyFormData, Pagination } from "../../types";

const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent";
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors";

type Filter = "all" | "active" | "blacklisted";

function Modal({ company, onSave, onClose }: { company: Company | null; onSave: (d: CompanyFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<CompanyFormData>({
    name: company?.name || "", website: company?.website || "", industry: company?.industry || "",
    notes: company?.notes || "", blacklisted: company?.blacklisted || false, blacklistReason: company?.blacklistReason || "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string | boolean) => setForm({ ...form, [k]: v });

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{company ? "Edit company" : "New company"}</h2>
          <button className={btnIcon} onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg></button>
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Name *</label><input className={inputCls} value={form.name} onChange={(e) => u("name", e.target.value)} required /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Industry</label><input className={inputCls} value={form.industry} onChange={(e) => u("industry", e.target.value)} /></div>
          </div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Website</label><input type="url" className={inputCls} value={form.website} onChange={(e) => u("website", e.target.value)} placeholder="https://..." /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.blacklisted} onChange={(e) => u("blacklisted", e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-ring/30" />
              Blacklisted
            </label>
          </div>
          {form.blacklisted && (
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Blacklist reason</label><input className={inputCls} value={form.blacklistReason} onChange={(e) => u("blacklistReason", e.target.value)} /></div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">{saving ? "Saving..." : company ? "Update" : "Add company"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-muted-foreground">Showing {(pag.page - 1) * pag.limit + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground transition-colors">Prev</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 text-sm rounded-lg transition-colors ${p === page ? "bg-primary text-primary-foreground" : "border border-border text-secondary-foreground hover:bg-muted"}`}>{p}</button>;
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground transition-colors">Next</button>
      </div>
    </div>
  );
}

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await companiesAPI.getAll({ page, limit: 20, search });
      setCompanies(res.data);
      setPag(res.pagination);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const save = async (d: CompanyFormData) => {
    if (editing) { await companiesAPI.update(editing._id, d); toast.success("Updated"); }
    else { await companiesAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchCompanies();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This company and all its links will be removed.", { title: "Delete company?", confirmLabel: "Delete" });
    if (!ok) return;
    await companiesAPI.delete(id);
    toast.success("Deleted");
    await fetchCompanies();
  };

  const filtered = companies.filter((c) => {
    if (filter === "active") return !c.blacklisted;
    if (filter === "blacklisted") return c.blacklisted;
    return true;
  });

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Companies</h1>
        <button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>
          Add company
        </button>
      </div>

      <div className="sticky top-[57px] z-20 bg-background/95 backdrop-blur-sm py-3 -mx-8 px-8">
        <div className="flex items-center gap-3">
          <input className={`${inputCls} max-w-[280px]`} placeholder="Search companies..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <div className="flex gap-1">
            {(["all", "active", "blacklisted"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-secondary-foreground hover:bg-border hover:bg-muted"}`}>
                {f === "all" ? "All" : f === "active" ? "Active" : "Blacklisted"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <h3 className="font-medium text-muted-foreground mb-1">No companies</h3>
          <p className="text-sm">Companies are auto-created when you add applications</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div key={c._id} className={`bg-card border border-border rounded-xl p-5 flex flex-col group cursor-pointer hover:shadow-md transition-shadow ${c.blacklisted ? "opacity-60" : ""}`} onClick={() => navigate(`/companies/${c._id}`)}>
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-[15px] font-semibold text-foreground ${c.blacklisted ? "line-through" : ""}`}>{c.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.industry && <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{c.industry}</span>}
                      {c.blacklisted && <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">Blacklisted</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button className={btnIcon} onClick={() => { setEditing(c); setModal(true); }}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" /></svg></button>
                    <button className={`${btnIcon} !text-danger`} onClick={() => handleDelete(c._id)}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4" /><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" /><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" /></svg></button>
                  </div>
                </div>
                {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:underline mb-1 truncate" onClick={(e) => e.stopPropagation()}>{c.website.replace(/^https?:\/\//, "")}</a>}
                {c.notes && <p className="text-[13px] text-muted-foreground line-clamp-2 mb-2">{c.notes}</p>}
              </div>
            ))}
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </>
      )}

      {modal && <Modal company={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
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
