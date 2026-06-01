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
import { Link } from "react-router-dom";
import {
  ChevronDown, FileText, Pencil, X, MapPin, Plus
} from "lucide-react";
import toast from "react-hot-toast";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import { STAGES, STAGE_BADGE_CLASS } from "../../../utils/stageStyles.ts";
import { Icons, IconKey } from "./fieldIcons.tsx";
import { tailorAPI, type TailorSession } from "../../../utils/api.ts";
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
              <Pencil size={14} strokeWidth={1.8} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              aria-label="Close detail panel"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto overscroll-contain flex-1">
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
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </button>
                }
                items={[
                  { label: "None", onClick: () => updateFormField("resumeId", ""), className: !form.resumeId ? "text-primary font-medium" : undefined },
                  ...resumes.map((r) => ({ label: r.name, onClick: () => updateFormField("resumeId", r._id), className: form.resumeId === r._id ? "text-primary font-medium" : undefined })),
                ]}
              />
            ) : resume ? (
              <button type="button" onClick={() => onViewResume(resume)} className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5">
                <FileText size={13} strokeWidth={1.5} />
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
                    <ChevronDown size={14} strokeWidth={1.5} />
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
                <MapPin size={11} strokeWidth={2} className="text-muted-foreground shrink-0" />
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
                    <ChevronDown size={14} strokeWidth={1.5} />
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

        {/* Tailor sessions — every AI analysis run against this application,
            newest first. Links straight back into the Tailor page. */}
        <TailorSessionsSection
          applicationId={app._id}
          company={app.company}
          role={app.role}
          hasJobDescription={!!app.jobDescription?.trim()}
        />

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

/* ============================================================== */
/* Tailor sessions — analysis history for this application       */
/* ============================================================== */

const SESSION_STATUS_TONE: Record<string, string> = {
  succeeded:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  deferred:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  failed:     "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const GRADE_TONE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  B: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  F: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

function TailorSessionsSection({
  applicationId,
  company,
  role,
  hasJobDescription,
}: {
  applicationId: string;
  company: string;
  role: string;
  /** When false, the "+ New" link is disabled and the empty-state copy points
   *  the user to add a JD before tailoring is possible. */
  hasJobDescription: boolean;
}) {
  const [sessions, setSessions] = useState<TailorSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    tailorAPI.listForApplication(applicationId)
      .then((list) => { if (!cancelled) setSessions(list); })
      .catch(() => { if (!cancelled) setError("Could not load tailor history."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applicationId]);

  const tailorUrl = `/tailor?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&applicationId=${applicationId}`;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-1.5">
        <FieldLabel icon="jd">Tailor sessions</FieldLabel>
        {hasJobDescription ? (
          <Link
            to={tailorUrl}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1"
          >
            New
            <Plus size={10} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        ) : (
          // No JD on this app → no Tailor session can be started. Visible chip
          // signals the action is unavailable instead of letting the user click
          // through to the Tailor page and get an empty-textarea dead-end.
          <span
            className="text-[11px] font-semibold text-muted-foreground/70 cursor-not-allowed select-none"
            title="Add a job description to this application before tailoring."
          >
            Add JD to enable
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !sessions || sessions.length === 0 ? (
        !hasJobDescription ? (
          <p className="text-sm text-muted-foreground">
            No analyses yet. Add a job description to this application before tailoring.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No analyses yet. <Link to={tailorUrl} className="text-primary hover:underline">Run analysis →</Link>
          </p>
        )
      ) : (
        <ul className="space-y-1.5">
          {sessions.map((s) => {
            const statusClass = SESSION_STATUS_TONE[s.status] ?? "bg-muted text-muted-foreground";
            const gradeClass = s.fitGrade ? GRADE_TONE[s.fitGrade] : null;
            return (
              <li key={s._id}>
                <Link
                  to={`/tailor?session=${s._id}`}
                  className="block rounded-lg border border-border bg-background hover:bg-muted/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                        {s.status}
                      </span>
                      {gradeClass && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${gradeClass}`}>
                          {s.fitGrade} · {s.fitScore}/5
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{fmt(s.createdAt)}</span>
                  </div>
                  {s.status === "failed" && s.errorMessage && (
                    <p className="text-[11.5px] text-red-600 dark:text-red-400 mt-1 truncate" title={s.errorMessage}>
                      {s.errorMessage}
                    </p>
                  )}
                  {s.jobTitle && s.status !== "failed" && (
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{s.jobTitle}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
