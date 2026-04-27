/**
 * Paginated application table with company grouping, expandable rows, right sidebar detail view.
 * Server search, client stage filter, CSV import/export, sortable columns.
 */
import { useState, useEffect, useCallback, useRef, useMemo, FormEvent, Fragment, MouseEvent as ReactMouseEvent } from "react";
import toast from "react-hot-toast";
import { applicationsAPI, resumesAPI, contactsAPI, deadlinesAPI } from "../../utils/api.ts";
import { exportToCSV } from "../../utils/csv.ts";
import ImportModal from "../../components/ImportModal/ImportModal.tsx";
import { SkeletonTable, SkeletonStats } from "../../components/Skeleton/Skeleton.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import type { Application, Resume, Contact, Deadline, Stage, ApplicationFormData, Pagination, SortConfig } from "../../types";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumeModal from "../../components/ResumeModal/ResumeModal.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { STAGES, STAGE_BADGE_CLASS, STAGE_FILTER_ACTIVE_CLASS, STAGE_FILTER_COUNT_CLASS } from "../../utils/stageStyles.ts";

const badgeCls: Record<Stage, string> = STAGE_BADGE_CLASS;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const SIDEBAR_WIDTH_KEY = "hiretrail-app-sidebar-width";
const SIDEBAR_MIN_WIDTH = 460;
const SIDEBAR_MAX_WIDTH = 920;
type SidebarEditForm = Partial<ApplicationFormData> & { jobDescription?: string };

function SortArrow({ field, sort }: { field: string; sort: SortConfig }) {
  const active = sort.field === field;
  return (
    <span className={`inline-flex flex-col ml-1 leading-none ${active ? "text-foreground" : "text-muted-foreground dark:text-secondary-foreground"}`}>
      <svg width="8" height="5" viewBox="0 0 8 5" className={active && sort.order === "asc" ? "text-foreground" : ""}><path d="M4 0L8 5H0L4 0Z" fill="currentColor" /></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" className={`mt-[1px] ${active && sort.order === "desc" ? "text-foreground" : ""}`}><path d="M4 5L0 0H8L4 5Z" fill="currentColor" /></svg>
    </span>
  );
}

function Modal({ app, resumes, onSave, onClose, onResumesChanged }: { app: Application | null; resumes: Resume[]; onSave: (d: ApplicationFormData) => Promise<void>; onClose: () => void; onResumesChanged: () => Promise<Resume[]> }) {
  const [form, setForm] = useState<ApplicationFormData>({ company: app?.company || "", role: app?.role || "", jobUrl: app?.jobUrl || "", stage: app?.stage || "Applied", notes: app?.notes || "", resumeId: app?.resumeId || "", companyId: app?.companyId || "", contactId: app?.contactId || "", outreachStatus: app?.outreachStatus || "none", location: app?.location || "", salary: app?.salary || "", jobType: app?.jobType || "" });
  const [saving, setSaving] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !showResumeModal) onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose, showResumeModal]);

  const handleAddResume = async (data: { name: string; targetRole: string; fileName: string; file: File | null }) => {
    const created = await resumesAPI.create(data);
    const updated = await onResumesChanged();
    u("resumeId", created._id);
    setShowResumeModal(false);
    toast.success("Resume added");
    return updated;
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-foreground">{app ? "Edit application" : "New application"}</h2><button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button></div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }} className="space-y-4">
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Company *</label><input className="input-premium" value={form.company} onChange={(e) => u("company", e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Role *</label><input className="input-premium" value={form.role} onChange={(e) => u("role", e.target.value)} required /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Job URL</label><input type="url" className="input-premium" value={form.jobUrl} onChange={(e) => u("jobUrl", e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Location</label><input className="input-premium" value={form.location || ""} onChange={(e) => u("location", e.target.value)} placeholder="City, remote, etc." /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Salary</label><input className="input-premium" value={form.salary || ""} onChange={(e) => u("salary", e.target.value)} placeholder="e.g. $120k–$150k" /></div>
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Job type</label><input className="input-premium" value={form.jobType || ""} onChange={(e) => u("jobType", e.target.value)} placeholder="Full-time, internship…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-foreground mb-1.5">Stage</label><select className="input-premium" value={form.stage} onChange={(e) => u("stage", e.target.value)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Resume</label>
              <div className="flex gap-1.5">
                <select className="input-premium flex-1" value={form.resumeId} onChange={(e) => u("resumeId", e.target.value)}><option value="">None</option>{resumes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}</select>
                <button type="button" onClick={() => setShowResumeModal(true)} title="Add new resume" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Notes</label><textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={(e) => u("notes", e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "Saving..." : app ? "Update" : "Add application"}</button></div>
        </form>
      </div>
    </div>
    {showResumeModal && <ResumeModal resume={null} existingTags={[...new Set(resumes.flatMap((r) => r.tags || []))].sort()} onSave={handleAddResume as any} onClose={() => setShowResumeModal(false)} />}
    </>
  );
}

function PaginationBar({ page, pag, setPage }: { page: number; pag: Pagination; setPage: (p: number) => void }) {
  if (pag.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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

/* ─── Application Detail Sidebar ─── */
function ApplicationDetailSidebar({
  app, resumes, contacts, deadlines, onClose, onStageChange, onViewResume, onSaveInline,
}: {
  app: Application;
  resumes: Resume[];
  contacts: Contact[];
  deadlines: Deadline[];
  onClose: () => void;
  onStageChange: (id: string, stage: Stage) => void;
  onViewResume: (resume: Resume) => void;
  onSaveInline: (id: string, data: SidebarEditForm) => Promise<void>;
}) {
  const [jdExpanded, setJdExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingInline, setSavingInline] = useState(false);
  const [closingAfterSave, setClosingAfterSave] = useState(false);
  const [form, setForm] = useState<SidebarEditForm>({
    company: app.company,
    role: app.role,
    jobUrl: app.jobUrl || "",
    stage: app.stage,
    notes: app.notes || "",
    resumeId: app.resumeId || "",
    location: app.location || "",
    salary: app.salary || "",
    jobType: app.jobType || "",
    contactId: app.contactId || "",
    jobDescription: app.jobDescription || "",
  });
  const [sidebarWidth, setSidebarWidth] = useState(560);
  const [resizing, setResizing] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(560);
  const suppressCloseRef = useRef(false);
  const resume = resumes.find((r) => r._id === app.resumeId);
  const companyContacts = contacts.filter((c) => c.company.toLowerCase() === app.company.toLowerCase());
  const appDeadlines = deadlines.filter((d) => d.applicationId === app._id && !d.completed);
  const selectedContact = contacts.find((c) => c._id === app.contactId);
  const isDirty = useMemo(() => {
    const normalize = (v?: string | null) => (v || "").trim();
    return (
      normalize(form.company) !== normalize(app.company)
      || normalize(form.role) !== normalize(app.role)
      || normalize(form.jobUrl) !== normalize(app.jobUrl)
      || normalize(form.stage) !== normalize(app.stage)
      || normalize(form.resumeId) !== normalize(app.resumeId)
      || normalize(form.location) !== normalize(app.location)
      || normalize(form.salary) !== normalize(app.salary)
      || normalize(form.jobType) !== normalize(app.jobType)
      || normalize(form.contactId) !== normalize(app.contactId)
      || normalize(form.notes) !== normalize(app.notes)
      || normalize(form.jobDescription) !== normalize(app.jobDescription)
    );
  }, [form, app]);
  const clampWidth = useCallback((w: number) => {
    const viewportMax = Math.max(SIDEBAR_MIN_WIDTH, window.innerWidth - 24);
    const maxAllowed = Math.min(SIDEBAR_MAX_WIDTH, viewportMax);
    return Math.max(Math.min(w, maxAllowed), SIDEBAR_MIN_WIDTH);
  }, []);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    const initial = Number.isFinite(saved) ? saved : 560;
    setSidebarWidth(clampWidth(initial));
  }, [clampWidth]);

  useEffect(() => {
    const onResize = () => setSidebarWidth((prev) => clampWidth(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampWidth]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  const [open, setOpen] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setOpen(true)); }, []);
  const finishClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };
  const enterEditMode = () => {
    setForm({
      company: app.company,
      role: app.role,
      jobUrl: app.jobUrl || "",
      stage: app.stage,
      notes: app.notes || "",
      resumeId: app.resumeId || "",
      location: app.location || "",
      salary: app.salary || "",
      jobType: app.jobType || "",
      contactId: app.contactId || "",
      jobDescription: app.jobDescription || "",
    });
    setIsEditing(true);
  };
  const cancelInlineEdit = () => {
    setIsEditing(false);
    setSavingInline(false);
  };
  const updateFormField = (key: keyof SidebarEditForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const saveInlineEdit = async () => {
    setSavingInline(true);
    try {
      await onSaveInline(app._id, form);
      setIsEditing(false);
      toast.success("Application updated");
    } catch {
      // handled by global interceptor
    } finally {
      setSavingInline(false);
    }
  };
  const handleClose = async () => {
    if (savingInline || closingAfterSave) return;
    if (isEditing && isDirty) {
      setClosingAfterSave(true);
      setSavingInline(true);
      try {
        await onSaveInline(app._id, form);
        setIsEditing(false);
        toast.success("Changes auto-saved");
        finishClose();
      } catch {
        // Keep sidebar open if auto-save fails.
      } finally {
        setSavingInline(false);
        setClosingAfterSave(false);
      }
      return;
    }
    finishClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") void handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [handleClose]);

  const handleResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = dragStartXRef.current - e.clientX;
      setSidebarWidth(clampWidth(dragStartWidthRef.current + delta));
    };
    const onUp = () => {
      setResizing(false);
      // Ignore the click generated at drag-end so backdrop doesn't close sidebar.
      setTimeout(() => { suppressCloseRef.current = false; }, 0);
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, clampWidth]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      onClick={() => {
        if (resizing || suppressCloseRef.current) return;
        void handleClose();
      }}
    >
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative h-full bg-card shadow-2xl flex flex-col border-l border-border transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${sidebarWidth}px`, maxWidth: "calc(100vw - 12px)" }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => {
          if (!isEditing) enterEditMode();
        }}
      >
      <div
        className={`absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize z-20 group ${resizing ? "bg-primary/30" : ""}`}
        onMouseDown={handleResizeStart}
        title={`Drag to resize (${SIDEBAR_MIN_WIDTH}px–${SIDEBAR_MAX_WIDTH}px)`}
      >
        <div className="h-full w-full group-hover:bg-primary/20" />
      </div>
      <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-foreground truncate">{app.role}</h2>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button onClick={enterEditMode} title="Edit details" className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg>
            </button>
          )}
          <button onClick={() => void handleClose()} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* ── Row 1: Company | Applied ── */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Company</label>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.company || ""} onChange={(e) => updateFormField("company", e.target.value)} />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{app.company}</span>
                {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline text-[11px]">Visit</a>}
              </div>
            )}
          </div>
          <div className="p-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Applied</label>
            <p className="text-sm text-foreground">
              {fmt(app.applicationDate)}
              <span className="text-muted-foreground text-xs ml-1">
                {new Date(app.applicationDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
          </div>
        </div>

        {/* ── Row 2: Resume | Stage ── */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Resume</label>
            {isEditing ? (
              <select className="input-premium !h-8 text-sm" value={form.resumeId || ""} onChange={(e) => updateFormField("resumeId", e.target.value)}>
                <option value="">None</option>
                {resumes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            ) : resume ? (
              <button onClick={() => onViewResume(resume)} className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>
                {resume.name}
              </button>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div className="p-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Stage</label>
            {isEditing ? (
              <select className="input-premium !h-8 text-sm" value={form.stage || app.stage} onChange={(e) => updateFormField("stage", e.target.value)}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s) => (
                  <button key={s} onClick={() => onStageChange(app._id, s)}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${app.stage === s ? badgeCls[s] + " border-current" : "bg-muted border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Location | Salary | Job Type ── */}
        <div className="grid grid-cols-3 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Location</label>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.location || ""} onChange={(e) => updateFormField("location", e.target.value)} />
            ) : app.location ? (
              <span className="inline-flex items-center gap-1 text-sm text-foreground">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {app.location}
              </span>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div className="p-4 border-r border-border/40">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Salary</label>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.salary || ""} onChange={(e) => updateFormField("salary", e.target.value)} />
            ) : (
              <p className={`text-sm ${app.salary ? "text-foreground" : "text-muted-foreground"}`}>{app.salary || "None"}</p>
            )}
          </div>
          <div className="p-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Job Type</label>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.jobType || ""} onChange={(e) => updateFormField("jobType", e.target.value)} />
            ) : (
              <p className={`text-sm ${app.jobType ? "text-foreground" : "text-muted-foreground"}`}>{app.jobType || "None"}</p>
            )}
          </div>
        </div>

        {/* ── Row 4: Job Description — full width, always shown ── */}
        <div className="px-4 py-4 border-b border-border/40">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Job Description</label>
          {isEditing ? (
            <textarea className="input-premium min-h-[110px] text-sm" value={form.jobDescription || app.jobDescription || ""} onChange={(e) => updateFormField("jobDescription", e.target.value)} />
          ) : app.jobDescription ? (
            <>
              <div className="text-sm text-secondary-foreground whitespace-pre-wrap">
                {jdExpanded ? app.jobDescription : app.jobDescription.slice(0, 200) + (app.jobDescription.length > 200 ? "..." : "")}
              </div>
              {app.jobDescription.length > 200 && (
                <button onClick={() => setJdExpanded(!jdExpanded)} className="text-xs text-muted-foreground hover:text-foreground hover:underline mt-1.5">
                  {jdExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>

        {/* ── Row 5: Contact | Deadlines ── */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Contact</label>
            {isEditing ? (
              <select className="input-premium !h-8 text-sm" value={form.contactId || ""} onChange={(e) => updateFormField("contactId", e.target.value)}>
                <option value="">None</option>
                {companyContacts.map((c) => <option key={c._id} value={c._id}>{c.name} - {c.role}</option>)}
              </select>
            ) : selectedContact ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">{selectedContact.name[0]}</div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{selectedContact.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedContact.role}</p>
                </div>
              </div>
            ) : companyContacts.length > 0 ? (
              <div className="space-y-2">
                {companyContacts.slice(0, 3).map((c) => (
                  <div key={c._id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">{c.name[0]}</div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div className="p-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Deadlines</label>
            {appDeadlines.length > 0 ? (
              <div className="space-y-1.5">
                {appDeadlines.map((d) => (
                  <div key={d._id} className="text-sm">
                    <span className="text-secondary-foreground">{d.type}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{fmt(d.dueDate)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
        </div>

        {/* ── Row 6: Notes — full width, always shown ── */}
        <div className="px-4 py-4 border-b border-border/40">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label>
          {isEditing ? (
            <textarea className="input-premium min-h-[100px] text-sm" value={form.notes || ""} onChange={(e) => updateFormField("notes", e.target.value)} />
          ) : app.notes ? (
            <p className="text-sm text-secondary-foreground whitespace-pre-wrap">{app.notes}</p>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>

        {/* ── Row 7: Stage History — full width, always shown ── */}
        <div className="px-4 py-4">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Stage History</label>
          {app.stageHistory.length > 0 ? (
            <div className="space-y-1.5">
              {app.stageHistory.map((sh, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${badgeCls[sh.stage]}`}>{sh.stage}</span>
                  <span className="text-xs text-muted-foreground">{fmt(sh.date)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>
        {isEditing && (
          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex items-center justify-end gap-2">
            <button type="button" onClick={cancelInlineEdit} className="btn-secondary">Cancel</button>
            <button type="button" onClick={saveInlineEdit} disabled={savingInline} className="btn-accent disabled:opacity-50">{savingInline ? "Saving..." : "Save changes"}</button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [archiveTab, setArchiveTab] = useState<"active" | "archived">("active");
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 });
  const [sort, setSort] = useState<SortConfig>({ field: "createdAt", order: "desc" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [sidebarApp, setSidebarApp] = useState<Application | null>(null);
  const [sidebarResume, setSidebarResume] = useState<Resume | null>(null);
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const [a, r, opposite, c, dl] = await Promise.all([
        applicationsAPI.getAll({ page, limit: 25, sort: sort.field, order: sort.order, search: debouncedSearch || undefined, archived: archiveTab === "archived" ? "true" : "false" }),
        resumesAPI.getAll(),
        applicationsAPI.getAll({ limit: 1, archived: archiveTab === "active" ? "true" : "false" }),
        contactsAPI.getAll({ limit: 500 }),
        deadlinesAPI.getAll({ limit: 500, status: "upcoming" }),
      ]);
      setApps(a.data); setPag(a.pagination); setResumes(r); setContacts(c.data); setDeadlines(dl.data);
      if (archiveTab === "active") { setActiveCount(a.pagination.total); setArchivedCount(opposite.pagination.total); }
      else { setArchivedCount(a.pagination.total); setActiveCount(opposite.pagination.total); }
    } catch {} finally { setLoading(false); }
  }, [page, sort, debouncedSearch, archiveTab]);

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
    if (editing) {
      const isNewlyRejected = d.stage === "Rejected" && editing.stage !== "Rejected";
      const updateData: Partial<ApplicationFormData & { archivedReason?: string }> = { ...d };
      if (isNewlyRejected) updateData.archivedReason = "rejected";
      await applicationsAPI.update(editing._id, updateData);
      if (isNewlyRejected) {
        toast.success("Application rejected. It will be auto-archived in 7 days.");
      } else {
        toast.success("Updated");
      }
    } else {
      await applicationsAPI.create(d);
      toast.success("Added");
    }
    setModal(false); setEditing(null); await fetchData();
  };

  const handleStageChange = async (id: string, stage: Stage) => {
    try {
      await applicationsAPI.update(id, { stage });
      toast.success(`Stage updated to ${stage}`);
      await fetchData();
      if (sidebarApp && sidebarApp._id === id) {
        setSidebarApp((prev) => prev ? { ...prev, stage } : null);
      }
    } catch {}
  };
  const handleSidebarSave = async (id: string, data: SidebarEditForm) => {
    await applicationsAPI.update(id, data);
    await fetchData();
    const updated = await applicationsAPI.getOne(id);
    setSidebarApp(updated);
  };

  const handleDelete = async (id: string) => { const ok = await confirmDelete("This application will be permanently deleted.", { title: "Delete application?", confirmLabel: "Delete" }); if (!ok) return; await applicationsAPI.delete(id); toast.success("Deleted"); await fetchData(); };
  const handleUnarchive = async (id: string) => { await applicationsAPI.unarchive(id); toast.success("Unarchived"); await fetchData(); };
  const toggleSort = (field: string) => { setSort((s) => ({ field, order: s.field === field && s.order === "desc" ? "asc" : "desc" })); setPage(1); };
  const toggleExpand = (company: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(company)) next.delete(company); else next.add(company); return next; });

  const filtered = filter === "All" ? apps : apps.filter((a) => a.stage === filter);
  const visibleAppIds = useMemo(() => filtered.map((a) => a._id), [filtered]);
  const selectedCount = selectedAppIds.size;
  const allVisibleSelected = visibleAppIds.length > 0 && visibleAppIds.every((id) => selectedAppIds.has(id));
  const stageCounts = STAGES.reduce((acc, s) => { acc[s] = apps.filter((a) => a.stage === s).length; return acc; }, {} as Record<string, number>);

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const app of filtered) {
      const key = app.company;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(app);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setSelectedAppIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(apps.map((app) => app._id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [apps]);

  useEffect(() => {
    if (!multiSelectEnabled) return;
    const expandedCompanies = grouped.filter(([, companyApps]) => companyApps.length > 1).map(([company]) => company);
    setExpanded(new Set(expandedCompanies));
  }, [multiSelectEnabled, grouped]);

  const toggleMultiSelectMode = () => {
    setMultiSelectEnabled((prev) => {
      if (prev) setSelectedAppIds(new Set());
      else {
        setSidebarApp(null);
        setSidebarResume(null);
      }
      return !prev;
    });
  };
  const toggleAppSelection = (id: string) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllVisible = () => {
    setSelectedAppIds((prev) => {
      if (allVisibleSelected) return new Set(Array.from(prev).filter((id) => !visibleAppIds.includes(id)));
      const next = new Set(prev);
      visibleAppIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const handleBulkArchive = async () => {
    if (selectedCount === 0) return;
    const ok = await confirmDelete(`Archive ${selectedCount} selected application${selectedCount === 1 ? "" : "s"}?`, { title: "Archive selected applications?", confirmLabel: "Archive", danger: false });
    if (!ok) return;
    await Promise.all(Array.from(selectedAppIds).map((id) => applicationsAPI.archive(id, "manual")));
    toast.success(`Archived ${selectedCount} application${selectedCount === 1 ? "" : "s"}`);
    setSelectedAppIds(new Set());
    setMultiSelectEnabled(false);
    await fetchData();
  };
  const handleBulkUnarchive = async () => {
    if (selectedCount === 0) return;
    const ok = await confirmDelete(`Unarchive ${selectedCount} selected application${selectedCount === 1 ? "" : "s"}?`, { title: "Unarchive selected applications?", confirmLabel: "Unarchive", danger: false });
    if (!ok) return;
    await Promise.all(Array.from(selectedAppIds).map((id) => applicationsAPI.unarchive(id)));
    toast.success(`Unarchived ${selectedCount} application${selectedCount === 1 ? "" : "s"}`);
    setSelectedAppIds(new Set());
    setMultiSelectEnabled(false);
    await fetchData();
  };
  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    const ok = await confirmDelete(`This will permanently delete ${selectedCount} selected application${selectedCount === 1 ? "" : "s"}.`, { title: "Delete selected applications?", confirmLabel: "Delete" });
    if (!ok) return;
    await Promise.all(Array.from(selectedAppIds).map((id) => applicationsAPI.delete(id)));
    toast.success(`Deleted ${selectedCount} application${selectedCount === 1 ? "" : "s"}`);
    setSelectedAppIds(new Set());
    setMultiSelectEnabled(false);
    await fetchData();
  };

  if (loading) return <div className="fade-up"><SkeletonStats /><SkeletonTable rows={8} /></div>;

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Applications</h1>
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

      <div className="flex gap-6 mb-4 border-b border-border">
        {([["active", "Active", activeCount], ["archived", "Archived", archivedCount]] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            onClick={() => { setArchiveTab(tab); setPage(1); setFilter("All"); }}
            className={`pb-2 text-sm font-medium border-b-2 ${archiveTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label} <span className="text-xs ml-1 text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      <div className="sticky top-[49px] z-20 bg-background/95 backdrop-blur-sm py-3 -mx-8 px-8">
        <div className="flex flex-wrap items-center gap-4 max-w-[1200px]">
          <input className="input-premium max-w-[280px]" placeholder="Search company or role..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {["All", ...STAGES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                disabled={multiSelectEnabled}
                className={`inline-flex items-center gap-1 px-3 py-1 text-[13px] font-medium rounded-full border disabled:opacity-45 disabled:cursor-not-allowed ${
                  s === "All"
                    ? (filter === s
                      ? "bg-muted border-border text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground")
                    : (filter === s
                      ? `${STAGE_FILTER_ACTIVE_CLASS[s as Stage]} shadow-sm`
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50")
                }`}
              >
                {s}
                {s !== "All" && (
                  <span
                    className={`text-[11px] px-1.5 rounded-full ${
                      filter === s
                        ? STAGE_FILTER_COUNT_CLASS[s as Stage]
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {stageCounts[s] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {multiSelectEnabled && <span className="text-xs text-muted-foreground">{selectedCount} selected</span>}
            <button onClick={toggleMultiSelectMode} className={multiSelectEnabled ? "btn-secondary border-border text-foreground" : "btn-secondary"}>
              {multiSelectEnabled ? "Cancel selection" : "Select multiple"}
            </button>
            {multiSelectEnabled && (
              <>
                <button
                  onClick={archiveTab === "archived" ? handleBulkUnarchive : handleBulkArchive}
                  disabled={selectedCount === 0}
                  className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {archiveTab === "archived" ? "Unarchive" : "Archive"}
                </button>
                <button onClick={handleBulkDelete} disabled={selectedCount === 0} className="btn-secondary border-danger text-danger hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium p-12 text-center text-muted-foreground">
          <h3 className="font-medium text-muted-foreground mb-1">No applications found</h3>
          <p className="text-sm">{search || filter !== "All" ? "Try adjusting filters" : "Add your first application"}</p>
        </div>
      ) : (
        <div className="card-premium card-no-lift overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="w-8 px-2 py-3">
                  {multiSelectEnabled && (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible applications"
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                  )}
                </th>
                {[{ l: "Company", f: "company" }, { l: "Role", f: "role" }, { l: "Stage", f: "stage" }, { l: "Resume", f: "" }, { l: "Applied", f: "applicationDate" }].map((h) => (
                  <th key={h.l} className={`text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 ${h.f ? "cursor-pointer hover:text-foreground select-none" : ""}`} onClick={() => h.f && toggleSort(h.f)}>
                    <span className="inline-flex items-center">{h.l}{h.f && <SortArrow field={h.f} sort={sort} />}</span>
                  </th>
                ))}
                <th className="w-20 px-4 py-3">{multiSelectEnabled ? "" : null}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {grouped.map(([company, companyApps]) => {
                  const isMulti = companyApps.length > 1;
                  const isExpanded = expanded.has(company);
                  const firstApp = companyApps[0];

                  if (!isMulti) {
                    // Single application - normal row with disabled chevron
                    return (
                      <tr key={firstApp._id} className="hover:bg-muted/50 group">
                        <td className="px-2 py-3">
                          {multiSelectEnabled ? (
                            <input
                              type="checkbox"
                              checked={selectedAppIds.has(firstApp._id)}
                              onChange={() => toggleAppSelection(firstApp._id)}
                              aria-label={`Select ${firstApp.company} ${firstApp.role}`}
                              className="h-4 w-4 accent-primary cursor-pointer"
                            />
                          ) : (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground/20"><path d="M4 2l5 5-5 5" /></svg>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{firstApp.company}</span>
                          {firstApp.jobUrl && <a href={firstApp.jobUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-muted-foreground/50 hover:text-foreground inline-flex opacity-0 group-hover:opacity-100 transition-opacity"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 6.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h3"/><polyline points="7,1.5 10.5,1.5 10.5,5"/><line x1="5.5" y1="6.5" x2="10.5" y2="1.5"/></svg></a>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]"><button onClick={() => { if (!multiSelectEnabled) setSidebarApp(firstApp); }} className={`text-sm text-left truncate block max-w-full ${multiSelectEnabled ? "text-muted-foreground cursor-default" : "text-foreground hover:underline"}`} title={firstApp.role}>{firstApp.role}</button></td>
                        <td className="px-4 py-3"><span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${badgeCls[firstApp.stage]}`}>{firstApp.stage}</span></td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">{(() => { const r = resumes.find((r) => r._id === firstApp.resumeId); return r ? <button onClick={() => setSidebarResume(r)} className="text-muted-foreground hover:text-foreground hover:underline text-left flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>{r.name}</button> : "—"; })()}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">{fmt(firstApp.applicationDate)}</td>
                        <td className="px-4 py-3">
                          {!multiSelectEnabled && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditing(firstApp); setModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
                              <button onClick={() => handleDelete(firstApp._id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4"/></svg></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // Multi-application company: header + expandable children
                  return (
                    <Fragment key={company}>
                      <tr className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpand(company)}>
                        <td className="px-2 py-3">
                          {multiSelectEnabled ? (
                            <input
                              type="checkbox"
                              checked={companyApps.every((app) => selectedAppIds.has(app._id))}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => {
                                const companyIds = companyApps.map((app) => app._id);
                                const allSelected = companyIds.every((id) => selectedAppIds.has(id));
                                setSelectedAppIds((prev) => {
                                  const next = new Set(prev);
                                  companyIds.forEach((id) => {
                                    if (allSelected) next.delete(id);
                                    else next.add(id);
                                  });
                                  return next;
                                });
                              }}
                              aria-label={`Select all applications for ${company}`}
                              className="h-4 w-4 accent-primary cursor-pointer"
                            />
                          ) : (
                            <button className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                                <path d="M4 2l5 5-5 5" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{company}</span>
                          <span className="ml-2 text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{companyApps.length} apps</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[200px]"><span className="truncate block" title={companyApps.map((a) => a.role).join(", ")}>{isExpanded ? "" : companyApps.map((a) => a.role).join(", ")}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">{[...new Set(companyApps.map((a) => a.stage))].map((s) => <span key={s} className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${badgeCls[s]}`}>{s}</span>)}</div>
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                      </tr>
                      {isExpanded && companyApps.map((a) => (
                        <tr key={a._id} className="hover:bg-muted/50 group bg-muted/30">
                          <td className="px-2 py-2.5">
                            {multiSelectEnabled ? (
                              <input
                                type="checkbox"
                                checked={selectedAppIds.has(a._id)}
                                onChange={() => toggleAppSelection(a._id)}
                                aria-label={`Select ${a.company} ${a.role}`}
                                className="h-4 w-4 accent-primary cursor-pointer"
                              />
                            ) : (
                              <div className="w-5 h-5 flex items-center justify-center">
                                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30"><path d="M2 1v5h6"/></svg>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[13px] text-muted-foreground">{a.company}</span>
                            {a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-muted-foreground/50 hover:text-foreground inline-flex opacity-0 group-hover:opacity-100 transition-opacity"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 5v2.5a.8.8 0 01-.8.8H2.5a.8.8 0 01-.8-.8V3.8a.8.8 0 01.8-.8H5"/><polyline points="6,1.2 8.8,1.2 8.8,4"/><line x1="4.5" y1="5.3" x2="8.8" y2="1.2"/></svg></a>}
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px]"><button onClick={() => { if (!multiSelectEnabled) setSidebarApp(a); }} className={`text-sm text-left truncate block max-w-full ${multiSelectEnabled ? "text-muted-foreground cursor-default" : "text-foreground hover:underline"}`} title={a.role}>{a.role}</button></td>
                          <td className="px-4 py-2.5"><span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${badgeCls[a.stage]}`}>{a.stage}</span></td>
                          <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{(() => { const r = resumes.find((r) => r._id === a.resumeId); return r ? <button onClick={(e) => { e.stopPropagation(); setSidebarResume(r); }} className="text-muted-foreground hover:text-foreground hover:underline text-left flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>{r.name}</button> : "—"; })()}</td>
                          <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{fmt(a.applicationDate)}</td>
                          <td className="px-4 py-2.5">
                            {!multiSelectEnabled && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditing(a); setModal(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(a._id); }} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger hover:border-danger"><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,4 10,4"/><path d="M4 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/><path d="M3 4l.6 7a.8.8 0 00.8.4h3.2a.8.8 0 00.8-.4L9 4"/></svg></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} pag={pag} setPage={setPage} />
        </div>
      )}

      {/* Sidebars */}
      {sidebarApp && (
        <ApplicationDetailSidebar
          app={sidebarApp}
          resumes={resumes}
          contacts={contacts}
          deadlines={deadlines}
          onClose={() => { setSidebarApp(null); setSidebarResume(null); }}
          onStageChange={handleStageChange}
          onViewResume={(r) => setSidebarResume(r)}
          onSaveInline={handleSidebarSave}
        />
      )}
      {sidebarResume && sidebarResume.fileUrl && <ResumePreview fileUrl={sidebarResume.fileUrl} name={sidebarResume.name} fileName={sidebarResume.fileName} onClose={() => setSidebarResume(null)} />}

      {modal && <Modal app={editing} resumes={resumes} onSave={handleSave} onClose={() => { setModal(false); setEditing(null); }} onResumesChanged={async () => { const r = await resumesAPI.getAll(); setResumes(r); return r; }} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onImported={fetchData} />}
      {confirmState.open && <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={onConfirm} onCancel={onCancel} />}
    </div>
  );
}
