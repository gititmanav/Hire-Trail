/**
 * Application detail body — the actual content (header, edit form, all field
 * sections). Reused by:
 *   - ApplicationDetailSidebar (overlay mode — wraps this in backdrop + slide).
 *   - The persistent right-column panel on the Applications page at xl+ widths.
 *
 * Owns its own editing state (form, isEditing, save logic) so callers don't
 * need to thread it through. When `app._id` changes (e.g. the persistent
 * panel's hovered row swaps), the form state resets — but only when NOT in
 * the middle of an edit. Editing locks the displayed row to avoid losing
 * the user's work on a hover.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import { STAGES, STAGE_BADGE_CLASS } from "../../../utils/stageStyles.ts";
import { Icons, IconKey } from "./fieldIcons.tsx";
import type { Application, Contact, Deadline, Resume, Stage, ApplicationFormData } from "../../../types";

function FieldLabel({ icon, children }: { icon: IconKey; children: React.ReactNode }) {
  const Glyph = Icons[icon];
  return (
    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
      <Glyph width={11} height={11} className="opacity-80" />
      {children}
    </label>
  );
}

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export type SidebarEditForm = Partial<ApplicationFormData> & { jobDescription?: string };

interface Props {
  app: Application;
  resumes: Resume[];
  contacts: Contact[];
  deadlines: Deadline[];
  onStageChange: (id: string, stage: Stage) => void;
  onViewResume: (resume: Resume) => void;
  onSaveInline: (id: string, data: SidebarEditForm) => Promise<void>;
  /** When provided, renders a close button in the header. Overlay sidebar
   *  uses this; the persistent panel doesn't pass it (no close from inline). */
  onClose?: () => void;
  /** Bubble up edit-mode transitions so the parent can lock hover-driven
   *  row changes while the user is editing. */
  onEditingChange?: (editing: boolean) => void;
}

export default function ApplicationDetailBody({
  app, resumes, contacts, deadlines,
  onStageChange, onViewResume, onSaveInline,
  onClose, onEditingChange,
}: Props) {
  const [jdExpanded, setJdExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingInline, setSavingInline] = useState(false);
  const [form, setForm] = useState<SidebarEditForm>(() => ({
    company: app.company, role: app.role, jobUrl: app.jobUrl || "",
    stage: app.stage, notes: app.notes || "",
    resumeId: app.resumeId || "",
    location: app.location || "", salary: app.salary || "", jobType: app.jobType || "",
    contactId: app.contactId || "",
    jobDescription: app.jobDescription || "",
  }));

  // When the displayed app changes (parent swapped to a different row),
  // re-seed the form — but ONLY if we're not in the middle of editing.
  // The parent should freeze hover-swaps while editing; this is a guard.
  useEffect(() => {
    if (isEditing) return;
    setForm({
      company: app.company, role: app.role, jobUrl: app.jobUrl || "",
      stage: app.stage, notes: app.notes || "",
      resumeId: app.resumeId || "",
      location: app.location || "", salary: app.salary || "", jobType: app.jobType || "",
      contactId: app.contactId || "",
      jobDescription: app.jobDescription || "",
    });
    setJdExpanded(false);
  }, [app, isEditing]);

  // Surface editing state upward so parents can lock hover-driven swaps.
  useEffect(() => { onEditingChange?.(isEditing); }, [isEditing, onEditingChange]);

  const resume = useMemo(() => resumes.find((r) => r._id === app.resumeId), [resumes, app.resumeId]);
  const companyContacts = useMemo(
    () => contacts.filter((c) => c.company.toLowerCase() === app.company.toLowerCase()),
    [contacts, app.company]
  );
  const appDeadlines = useMemo(
    () => deadlines.filter((d) => d.applicationId === app._id && !d.completed),
    [deadlines, app._id]
  );
  const selectedContact = useMemo(
    () => contacts.find((c) => c._id === app.contactId),
    [contacts, app.contactId]
  );

  const enterEditMode = useCallback(() => {
    setForm({
      company: app.company, role: app.role, jobUrl: app.jobUrl || "",
      stage: app.stage, notes: app.notes || "",
      resumeId: app.resumeId || "",
      location: app.location || "", salary: app.salary || "", jobType: app.jobType || "",
      contactId: app.contactId || "",
      jobDescription: app.jobDescription || "",
    });
    setIsEditing(true);
  }, [app]);

  const cancelInlineEdit = () => { setIsEditing(false); setSavingInline(false); };
  const updateFormField = (key: keyof SidebarEditForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const saveInlineEdit = async () => {
    setSavingInline(true);
    try {
      await onSaveInline(app._id, form);
      setIsEditing(false);
      toast.success("Application updated");
    } catch { /* interceptor handles toast */ }
    finally { setSavingInline(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <h2 className="text-lg font-semibold text-foreground truncate">{app.role}</h2>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={enterEditMode}
              title="Edit details"
              aria-label="Edit details"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z"/></svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              aria-label="Close detail panel"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Company | Applied */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <FieldLabel icon="company">Company</FieldLabel>
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
            <FieldLabel icon="calendar">Applied</FieldLabel>
            <p className="text-sm text-foreground">
              {fmt(app.applicationDate)}
              <span className="text-muted-foreground text-xs ml-1">
                {new Date(app.applicationDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </p>
          </div>
        </div>

        {/* Resume | Stage */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <FieldLabel icon="resume">Resume</FieldLabel>
            {isEditing ? (
              <ActionDropdown
                align="left" menuWidth="w-full" searchable searchPlaceholder="Search resumes..." maxVisibleItems={8}
                trigger={
                  <button type="button" className="input-premium !h-8 text-sm flex items-center justify-between text-left">
                    <span className="truncate">{resumes.find((r) => r._id === form.resumeId)?.name || "None"}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                }
                items={[
                  { label: "None", onClick: () => updateFormField("resumeId", ""), className: !form.resumeId ? "text-primary font-medium" : undefined },
                  ...resumes.map((r) => ({ label: r.name, onClick: () => updateFormField("resumeId", r._id), className: form.resumeId === r._id ? "text-primary font-medium" : undefined })),
                ]}
              />
            ) : resume ? (
              <button type="button" onClick={() => onViewResume(resume)} className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/></svg>
                {resume.name}
              </button>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div className="p-4">
            <FieldLabel icon="source">Stage</FieldLabel>
            {isEditing ? (
              <ActionDropdown
                align="left" menuWidth="w-full"
                trigger={
                  <button type="button" className="input-premium !h-8 text-sm flex items-center justify-between text-left">
                    <span>{form.stage || app.stage}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                }
                items={STAGES.map((s) => ({ label: s, onClick: () => updateFormField("stage", s), className: (form.stage || app.stage) === s ? "text-primary font-medium" : undefined }))}
              />
            ) : (
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s) => (
                  <button key={s} type="button" onClick={() => onStageChange(app._id, s)}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${app.stage === s ? STAGE_BADGE_CLASS[s] + " border-current" : "bg-muted border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Location | Salary | Job Type */}
        <div className="grid grid-cols-3 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <FieldLabel icon="location">Location</FieldLabel>
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
            <FieldLabel icon="salary">Salary</FieldLabel>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.salary || ""} onChange={(e) => updateFormField("salary", e.target.value)} />
            ) : (
              <p className={`text-sm ${app.salary ? "text-foreground" : "text-muted-foreground"}`}>{app.salary || "None"}</p>
            )}
          </div>
          <div className="p-4">
            <FieldLabel icon="jobType">Job Type</FieldLabel>
            {isEditing ? (
              <input className="input-premium !h-8 text-sm" value={form.jobType || ""} onChange={(e) => updateFormField("jobType", e.target.value)} />
            ) : (
              <p className={`text-sm ${app.jobType ? "text-foreground" : "text-muted-foreground"}`}>{app.jobType || "None"}</p>
            )}
          </div>
        </div>

        {/* JD */}
        <div className="px-4 py-4 border-b border-border/40">
          <FieldLabel icon="jd">Job Description</FieldLabel>
          {isEditing ? (
            <textarea className="input-premium min-h-[110px] text-sm" value={form.jobDescription || app.jobDescription || ""} onChange={(e) => updateFormField("jobDescription", e.target.value)} />
          ) : app.jobDescription ? (
            <>
              <div className="text-sm text-secondary-foreground whitespace-pre-wrap">
                {jdExpanded ? app.jobDescription : app.jobDescription.slice(0, 200) + (app.jobDescription.length > 200 ? "..." : "")}
              </div>
              {app.jobDescription.length > 200 && (
                <button type="button" onClick={() => setJdExpanded(!jdExpanded)} className="text-xs text-muted-foreground hover:text-foreground hover:underline mt-1.5">
                  {jdExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>

        {/* Contact | Deadlines */}
        <div className="grid grid-cols-2 border-b border-border/40">
          <div className="p-4 border-r border-border/40">
            <FieldLabel icon="contact">Contact</FieldLabel>
            {isEditing ? (
              <ActionDropdown
                align="left" menuWidth="w-full" searchable searchPlaceholder="Search contacts..." maxVisibleItems={8}
                trigger={
                  <button type="button" className="input-premium !h-8 text-sm flex items-center justify-between text-left">
                    <span className="truncate">{contacts.find((c) => c._id === form.contactId)?.name || "None"}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                }
                items={[
                  { label: "None", onClick: () => updateFormField("contactId", ""), className: !form.contactId ? "text-primary font-medium" : undefined },
                  ...companyContacts.map((c) => ({ label: `${c.name} - ${c.role || "Contact"}`, onClick: () => updateFormField("contactId", c._id), className: form.contactId === c._id ? "text-primary font-medium" : undefined })),
                ]}
              />
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
            <FieldLabel icon="deadline">Deadlines</FieldLabel>
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

        {/* Notes */}
        <div className="px-4 py-4 border-b border-border/40">
          <FieldLabel icon="notes">Notes</FieldLabel>
          {isEditing ? (
            <textarea className="input-premium min-h-[100px] text-sm" value={form.notes || ""} onChange={(e) => updateFormField("notes", e.target.value)} />
          ) : app.notes ? (
            <p className="text-sm text-secondary-foreground whitespace-pre-wrap">{app.notes}</p>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>

        {/* Stage history */}
        <div className="px-4 py-4">
          <FieldLabel icon="calendar">Stage History</FieldLabel>
          {app.stageHistory.length > 0 ? (
            <div className="space-y-1.5">
              {app.stageHistory.map((sh, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${STAGE_BADGE_CLASS[sh.stage]}`}>{sh.stage}</span>
                  <span className="text-xs text-muted-foreground">{fmt(sh.date)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">None</p>}
        </div>

        {isEditing && (
          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex items-center justify-end gap-2 z-10">
            <button type="button" onClick={cancelInlineEdit} className="btn-secondary">Cancel</button>
            <button type="button" onClick={saveInlineEdit} disabled={savingInline} className="btn-accent disabled:opacity-50">{savingInline ? "Saving..." : "Save changes"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
