/** Deadlines filtered server-side by status tab; linked to applications when set. */
import { useState, useEffect, useCallback, FormEvent } from "react";
import toast from "react-hot-toast";
import { deadlinesAPI, applicationsAPI } from "../../utils/api.ts";
import { SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Deadline, Application, DeadlineFormData, Pagination } from "../../types";

const TYPES = ["OA due date", "Follow-up reminder", "Interview prep", "Offer decision", "Thank you note", "Other"];
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const daysN = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const dueLabel = (d: string) => { const n = daysN(d); return n < 0 ? "Overdue" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} days`; };
const dueCls = (d: string, done: boolean) => {
  if (done) return "bg-success-light text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  const n = daysN(d);
  if (n < 0) return "bg-danger-light text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (n <= 2) return "bg-warning-light text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (n <= 7) return "bg-primary/10 text-primary bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
};
const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent";
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors";

function Modal({ deadline: dl, applications: apps, onSave, onClose }: { deadline: Deadline | null; applications: Application[]; onSave: (d: DeadlineFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<DeadlineFormData>({ applicationId: dl?.applicationId || "", type: dl?.type || "", dueDate: dl?.dueDate ? new Date(dl.dueDate).toISOString().split("T")[0] : "", notes: dl?.notes || "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">{dl ? "Edit deadline" : "New deadline"}</h2><button className={btnIcon} onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg></button></div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-foreground mb-1.5">Type *</label><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required><option value="">Select...</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div><div><label className="block text-sm font-medium text-foreground mb-1.5">Due date *</label><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Application</label><select className={inputCls} value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}><option value="">None</option>{apps.map((a) => <option key={a._id} value={a._id}>{a.company} — {a.role}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">{saving ? "Saving..." : dl ? "Update" : "Add deadline"}</button></div>
        </form>
      </div>
    </div>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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

export default function Deadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [filter, setFilter] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [tabCounts, setTabCounts] = useState({ upcoming: 0, overdue: 0, completed: 0 });
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchData = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        deadlinesAPI.getAll({ page, limit: 20, status: filter as "all" | "upcoming" | "overdue" | "completed" }),
        applicationsAPI.getAll({ limit: 999 }),
      ]);
      setDeadlines(d.data);
      setPag(d.pagination);
      setApps(a.data);
      if (d.counts) setTabCounts(d.counts);
    } catch {} finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async (d: DeadlineFormData) => {
    if (editing) { await deadlinesAPI.update(editing._id, d); toast.success("Updated"); }
    else { await deadlinesAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchData();
  };
  const toggle = async (d: Deadline) => { await deadlinesAPI.update(d._id, { completed: !d.completed }); toast.success(d.completed ? "Marked incomplete" : "Marked complete"); await fetchData(); };
  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This deadline will be permanently deleted.", { title: "Delete deadline?", confirmLabel: "Delete" });
    if (!ok) return;
    await deadlinesAPI.delete(id);
    toast.success("Deleted");
    await fetchData();
  };
  const appLabel = (id: string | null) => { if (!id) return null; const a = apps.find((x) => x._id === id); return a ? `${a.company} — ${a.role}` : null; };

  const uc = tabCounts.upcoming;
  const oc = tabCounts.overdue;
  const cc = tabCounts.completed;

  if (loading) return <SkeletonTable rows={6} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold text-foreground">Deadlines</h1><button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>Add deadline</button>      </div>

      <div className="sticky top-[57px] z-20 bg-background/95 backdrop-blur-sm -mx-8 px-8 flex gap-1 border-b border-border mb-4">
        {([["upcoming", "Upcoming", uc], ["overdue", "Overdue", oc], ["completed", "Completed", cc], ["all", "All", 0]] as [string, string, number][]).map(([k, l, c]) => (
          <button key={k} onClick={() => { setPage(1); setFilter(k); }} className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${filter === k ? "text-primary border-accent" : "text-muted-foreground border-transparent hover:text-foreground"}`}>{l}{c > 0 && <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${k === "overdue" ? "bg-danger-light text-danger" : "bg-muted text-muted-foreground"}`}>{c}</span>}</button>
        ))}
      </div>

      {deadlines.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground"><h3 className="font-medium text-muted-foreground mb-1">{filter === "upcoming" ? "No upcoming deadlines" : filter === "overdue" ? "No overdue deadlines" : filter === "completed" ? "No completed deadlines" : "No deadlines yet"}</h3><p className="text-sm">{filter === "upcoming" ? "You're all caught up!" : "Add deadlines to stay on track"}</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {deadlines.map((d) => (
            <div key={d._id} className={`flex items-center gap-3 px-5 py-3 group ${d.completed ? "opacity-50" : ""}`}>
              <button onClick={() => toggle(d)} className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${d.completed ? "bg-success border-success text-white" : "border-border hover:border-primary"}`}>
                {d.completed && <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="2,6 5,9 10,3" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{d.type}</span>
                {appLabel(d.applicationId) && <span className="block text-xs text-muted-foreground">{appLabel(d.applicationId)}</span>}
                {d.notes && <span className="block text-xs text-muted-foreground truncate">{d.notes}</span>}
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dueCls(d.dueDate, d.completed)}`}>{d.completed ? "Done" : dueLabel(d.dueDate)}</span>
                <span className="text-[11px] text-muted-foreground">{fmt(d.dueDate)}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className={btnIcon} onClick={() => { setEditing(d); setModal(true); }}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" /></svg></button>
                <button className={`${btnIcon} !text-danger`} onClick={() => handleDelete(d._id)}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4" /><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" /><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" /></svg></button>
              </div>
            </div>
          ))}
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </div>
      )}

      {modal && <Modal deadline={editing} applications={apps} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
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