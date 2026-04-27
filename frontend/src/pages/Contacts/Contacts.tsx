/** Paginated contact cards with client-side search across the current page. */
import { useState, useEffect, useCallback, FormEvent } from "react";
import toast from "react-hot-toast";
import { contactsAPI } from "../../utils/api.ts";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import type { Contact, ContactFormData, ContactOutreachStatus, Pagination } from "../../types";

const SOURCES = ["Cold email", "Referral", "Career fair", "LinkedIn", "Professor intro", "Alumni network", "Other"];
const OUTREACH_STATUSES: { value: ContactOutreachStatus; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "reached_out", label: "Reached out" },
  { value: "responded", label: "Responded" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "gone_cold", label: "Gone cold" },
];
const OUTREACH_COLORS: Record<ContactOutreachStatus, string> = {
  not_contacted: "bg-muted text-muted-foreground",
  reached_out: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  responded: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  meeting_scheduled: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  follow_up_needed: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  gone_cold: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted";
const normalizeOutreachStatus = (status?: ContactOutreachStatus | null): ContactOutreachStatus => status || "not_contacted";

function needsFollowUp(c: Contact): boolean {
  if (c.nextFollowUpDate) {
    const due = new Date(c.nextFollowUpDate); due.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (due.getTime() <= now.getTime()) return true;
  }
  if (c.outreachStatus === "reached_out" && c.lastOutreachDate) {
    if (Date.now() - new Date(c.lastOutreachDate).getTime() > 7 * 86400000) return true;
  }
  return false;
}

function Modal({ contact, onSave, onClose }: { contact: Contact | null; onSave: (d: ContactFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<ContactFormData>({
    name: contact?.name || "", company: contact?.company || "", role: contact?.role || "",
    linkedinUrl: contact?.linkedinUrl || "", connectionSource: contact?.connectionSource || "", notes: contact?.notes || "",
    companyId: contact?.companyId || "", applicationIds: contact?.applicationIds || [],
    outreachStatus: contact?.outreachStatus || "not_contacted",
    nextFollowUpDate: contact?.nextFollowUpDate ? contact.nextFollowUpDate.split("T")[0] : "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">{contact ? "Edit contact" : "New contact"}</h2><button className={btnIcon} onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg></button></div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-foreground mb-1.5">Name *</label><input className={inputCls} value={form.name} onChange={(e) => u("name", e.target.value)} required /></div><div><label className="block text-sm font-medium text-foreground mb-1.5">Company *</label><input className={inputCls} value={form.company} onChange={(e) => u("company", e.target.value)} required /></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Role</label><input className={inputCls} value={form.role} onChange={(e) => u("role", e.target.value)} /></div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">How connected</label>
              <ActionDropdown
                align="left"
                menuWidth="w-full"
                searchable
                searchPlaceholder="Search source..."
                trigger={
                  <button className={`${inputCls} h-9 flex items-center justify-between text-left`}>
                    <span className="truncate">{form.connectionSource || "Select..."}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                }
                items={[
                  { label: "Select...", onClick: () => u("connectionSource", ""), className: !form.connectionSource ? "text-primary font-medium" : undefined },
                  ...SOURCES.map((s) => ({ label: s, onClick: () => u("connectionSource", s), className: form.connectionSource === s ? "text-primary font-medium" : undefined })),
                ]}
              />
            </div>
          </div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">LinkedIn URL</label><input type="url" className={inputCls} value={form.linkedinUrl} onChange={(e) => u("linkedinUrl", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Outreach status</label>
              <ActionDropdown
                align="left"
                menuWidth="w-full"
                trigger={
                  <button className={`${inputCls} h-9 flex items-center justify-between text-left`}>
                    <span>{OUTREACH_STATUSES.find((s) => s.value === form.outreachStatus)?.label || "Not contacted"}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                }
                items={OUTREACH_STATUSES.map((s) => ({
                  label: s.label,
                  onClick: () => u("outreachStatus", s.value),
                  className: form.outreachStatus === s.value ? "text-primary font-medium" : undefined,
                }))}
              />
            </div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Follow-up date</label><input type="date" className={inputCls} value={form.nextFollowUpDate} onChange={(e) => u("nextFollowUpDate", e.target.value)} /></div>
          </div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">{saving ? "Saving..." : contact ? "Update" : "Add contact"}</button></div>
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
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Prev</button>
        {Array.from({ length: Math.min(pag.pages, 5) }, (_, i) => {
          const p = pag.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pag.pages - 2 ? pag.pages - 4 + i : page - 2 + i;
          return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 text-sm rounded-lg ${p === page ? "bg-primary text-primary-foreground" : "border border-border text-secondary-foreground hover:bg-muted"}`}>{p}</button>;
        })}
        <button disabled={page >= pag.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted text-secondary-foreground">Next</button>
      </div>
    </div>
  );
}

function OutreachBadge({ status }: { status: ContactOutreachStatus }) {
  const label = OUTREACH_STATUSES.find((s) => s.value === status)?.label || status;
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${OUTREACH_COLORS[status] || OUTREACH_COLORS.not_contacted}`}>{label}</span>;
}

function ContactCard({ c, onEdit, onDelete }: { c: Contact; onEdit: () => void; onDelete: () => void }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const hasLongNotes = c.notes && c.notes.length > 120;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col group">
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-10 h-10 rounded-full bg-muted text-secondary-foreground flex items-center justify-center text-[13px] font-semibold shrink-0">{ini(c.name)}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">{c.name}</h3>
          <p className="text-[13px] text-muted-foreground">{c.role ? `${c.role} at ` : ""}{c.company}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className={btnIcon} onClick={onEdit}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" /></svg></button>
          <button className={`${btnIcon} !text-danger`} onClick={onDelete}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4" /><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" /><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" /></svg></button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {c.outreachStatus && <OutreachBadge status={c.outreachStatus} />}
        {c.connectionSource && <span className="inline-block text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{c.connectionSource}</span>}
      </div>
      {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:text-primary/90 hover:underline mb-1">LinkedIn profile</a>}
      {c.notes && (
        <div className="mb-2">
          <p className={`text-[13px] text-muted-foreground ${notesExpanded ? "" : "line-clamp-3"}`}>{c.notes}</p>
          {hasLongNotes && (
            <button onClick={() => setNotesExpanded(!notesExpanded)} className="text-[12px] text-muted-foreground hover:text-foreground hover:underline mt-0.5">
              {notesExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
      <div className="mt-auto pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Last contact: {fmt(c.lastContactDate)}</span>
        {c.nextFollowUpDate && <span className={needsFollowUp(c) ? "text-orange-500 font-medium" : ""}>Follow-up: {fmt(c.nextFollowUpDate)}</span>}
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
  const [statusFilter, setStatusFilter] = useState<"All" | ContactOutreachStatus>("All");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [viewMode, setViewMode] = useState<"person" | "company">("person");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

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
  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This contact will be permanently deleted.", { title: "Delete contact?", confirmLabel: "Delete" });
    if (!ok) return;
    await contactsAPI.delete(id);
    toast.success("Deleted");
    await fetchContacts();
  };

  const statusCounts = OUTREACH_STATUSES.reduce((acc, s) => {
    acc[s.value] = contacts.filter((c) => normalizeOutreachStatus(c.outreachStatus) === s.value).length;
    return acc;
  }, {} as Record<ContactOutreachStatus, number>);

  const filtered = contacts.filter((c) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || normalizeOutreachStatus(c.outreachStatus) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          Contacts
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            {pag.total}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode("person")} className={`px-3 py-1.5 text-xs font-medium ${viewMode === "person" ? "bg-muted text-foreground" : "bg-card text-secondary-foreground hover:bg-muted"}`}>By Person</button>
            <button onClick={() => setViewMode("company")} className={`px-3 py-1.5 text-xs font-medium ${viewMode === "company" ? "bg-muted text-foreground" : "bg-card text-secondary-foreground hover:bg-muted"}`}>By Company</button>
          </div>
          <button onClick={() => { setEditing(null); setModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>Add contact</button>
        </div>
      </div>

      <div className="sticky top-[57px] z-20 bg-background/95 backdrop-blur-sm py-3 -mx-8 px-8">
        <div className="flex flex-wrap items-center gap-3 max-w-[1200px]">
          <input className={`${inputCls} w-[280px]`} placeholder="Search name or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter("All")}
              className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border ${statusFilter === "All" ? "bg-muted border-border text-foreground" : "bg-card border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`}
            >
              All
            </button>
            {OUTREACH_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border ${statusFilter === s.value ? "bg-muted border-border text-foreground" : "bg-card border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`}
              >
                {s.label}
                <span className="text-[11px] bg-muted px-1.5 rounded-full">{statusCounts[s.value] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground"><h3 className="font-medium text-muted-foreground mb-1">No contacts</h3><p className="text-sm">No contacts match your search and outreach status filter.</p></div>
      ) : viewMode === "person" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => <ContactCard key={c._id} c={c} onEdit={() => { setEditing(c); setModal(true); }} onDelete={() => handleDelete(c._id)} />)}
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </>
      ) : (
        <>
          <div className="space-y-3">
            {Object.entries(
              filtered.reduce<Record<string, Contact[]>>((acc, c) => {
                const key = c.company || "Unknown";
                (acc[key] = acc[key] || []).push(c);
                return acc;
              }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([company, companyContacts]) => {
                const isExpanded = expandedCompanies.has(company);
                const hasFollowUp = companyContacts.some(needsFollowUp);
                return (
                  <div key={company} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedCompanies((prev) => {
                        const next = new Set(prev);
                        if (next.has(company)) next.delete(company); else next.add(company);
                        return next;
                      })}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}><path d="M6 4l4 4-4 4" /></svg>
                        <span className="text-[15px] font-semibold text-foreground">{company}</span>
                        <span className="text-xs text-muted-foreground font-medium">{companyContacts.length} contact{companyContacts.length !== 1 ? "s" : ""}</span>
                        {hasFollowUp && <span className="w-2 h-2 rounded-full bg-orange-400" title="Has contacts needing follow-up" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {companyContacts.map((c) => <ContactCard key={c._id} c={c} onEdit={() => { setEditing(c); setModal(true); }} onDelete={() => handleDelete(c._id)} />)}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </>
      )}

      {modal && <Modal contact={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
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