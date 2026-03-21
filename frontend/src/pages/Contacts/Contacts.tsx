import { useState, useEffect, useCallback, FormEvent } from "react";
import toast from "react-hot-toast";
import { contactsAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import type { Contact, ContactFormData, Pagination } from "../../types";

const SOURCES = ["Cold email", "Referral", "Career fair", "LinkedIn", "Professor intro", "Alumni network", "Other"];
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors";

function Modal({ contact, onSave, onClose }: { contact: Contact | null; onSave: (d: ContactFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<ContactFormData>({ name: contact?.name || "", company: contact?.company || "", role: contact?.role || "", linkedinUrl: contact?.linkedinUrl || "", connectionSource: contact?.connectionSource || "", notes: contact?.notes || "" });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{contact ? "Edit contact" : "New contact"}</h2><button className={btnIcon} onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg></button></div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Name *</label><input className={inputCls} value={form.name} onChange={(e) => u("name", e.target.value)} required /></div><div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Company *</label><input className={inputCls} value={form.company} onChange={(e) => u("company", e.target.value)} required /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Role</label><input className={inputCls} value={form.role} onChange={(e) => u("role", e.target.value)} /></div><div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">How connected</label><select className={inputCls} value={form.connectionSource} onChange={(e) => u("connectionSource", e.target.value)}><option value="">Select...</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">LinkedIn URL</label><input type="url" className={inputCls} value={form.linkedinUrl} onChange={(e) => u("linkedinUrl", e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-1.5">Notes</label><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-50">{saving ? "Saving..." : contact ? "Update" : "Add contact"}</button></div>
        </form>
      </div>
    </div>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">Showing {(pag.page - 1) * pag.limit + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">Prev</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 text-sm rounded-lg transition-colors ${p === page ? "bg-accent text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>{p}</button>;
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">Next</button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });

  const fetchContacts = useCallback(async () => {
    try {
      const res = await contactsAPI.getAll({ page, limit: 20 });
      setContacts(res.data);
      setPag(res.pagination);
    } catch {} finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const save = async (d: ContactFormData) => {
    if (editing) { await contactsAPI.update(editing._id, d); toast.success("Updated"); }
    else { await contactsAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchContacts();
  };
  const del = async (id: string) => { if (!confirm("Delete this contact?")) return; await contactsAPI.delete(id); toast.success("Deleted"); await fetchContacts(); };

  const filtered = contacts.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Contacts</h1><button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>Add contact</button></div>

      {/* Sticky search bar */}
      <div className="sticky top-[57px] z-20 bg-page/95 dark:bg-gray-900/95 backdrop-blur-sm py-3 -mx-8 px-8">
        <input className={`${inputCls} max-w-[280px]`} placeholder="Search name or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400"><h3 className="font-medium text-gray-500 mb-1">No contacts</h3><p className="text-sm">Track recruiters, referrals, and hiring managers</p></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div key={c._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col group">
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="w-10 h-10 rounded-full bg-accent-light dark:bg-accent/20 text-accent-dark dark:text-accent flex items-center justify-center text-[13px] font-semibold shrink-0">{ini(c.name)}</div>
                  <div className="flex-1 min-w-0"><h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{c.name}</h3><p className="text-[13px] text-gray-500 dark:text-gray-400">{c.role ? `${c.role} at ` : ""}{c.company}</p></div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className={btnIcon} onClick={() => { setEditing(c); setModal(true); }}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" /></svg></button>
                    <button className={`${btnIcon} !text-danger`} onClick={() => del(c._id)}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4" /><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" /><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" /></svg></button>
                  </div>
                </div>
                {c.connectionSource && <span className="inline-block text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full mb-1 w-fit">{c.connectionSource}</span>}
                {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline mb-1">LinkedIn profile</a>}
                {c.notes && <p className="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-3 mb-2">{c.notes}</p>}
                <div className="mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">Last contact: {fmt(c.lastContactDate)}</div>
              </div>
            ))}
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </>
      )}

      {modal && <Modal contact={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
    </div>
  );
}