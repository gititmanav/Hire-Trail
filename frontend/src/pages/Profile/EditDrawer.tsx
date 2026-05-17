/** Right-side slide-in drawer for inline-editing a single Master Profile section.
 *  All edits stay client-side until "Update" is clicked; then we PUT the changed
 *  section keys back to the master profile. */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { masterProfileAPI } from "../../utils/api.ts";

/* ---------- types (kept loose for runtime flexibility) ---------- */
export type SectionKey = "personal" | "experience" | "projects" | "education" | "skills" | "certifications";

interface Bullet { text: string; tags: string[] }
interface Experience { company: string; role: string; location: string; startDate: string; endDate: string; current: boolean; bullets: Bullet[] }
interface Project { name: string; url: string; description: string; bullets: Bullet[]; technologies: string[] }
interface Education { school: string; degree: string; field: string; location: string; startDate: string; endDate: string; gpa: string; highlights: string[] }
interface SkillGroup { category: string; items: string[] }
interface Certification { name: string; issuer: string; date: string; url: string }
interface Contact { fullName: string; email: string; phone: string; location: string; linkedin: string; github: string; portfolio: string }

interface ProfileLike {
  contact: Contact;
  summary: string;
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  skills: SkillGroup[];
  certifications: Certification[];
}

interface Props {
  section: SectionKey;
  profile: ProfileLike;
  onClose: () => void;
  /** Receives the (server-side) updated profile so parent can re-render. */
  onSaved: (updated: ProfileLike) => void;
}

const SECTION_TITLE: Record<SectionKey, string> = {
  personal: "Personal",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
};

const blank = {
  experience: (): Experience => ({ company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [] }),
  project: (): Project => ({ name: "", url: "", description: "", bullets: [], technologies: [] }),
  education: (): Education => ({ school: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "", highlights: [] }),
  skillGroup: (): SkillGroup => ({ category: "", items: [] }),
  certification: (): Certification => ({ name: "", issuer: "", date: "", url: "" }),
};

export default function EditDrawer({ section, profile, onClose, onSaved }: Props) {
  // Local working copy for the section being edited.
  const [contact, setContact] = useState<Contact>(profile.contact);
  const [summary, setSummary] = useState(profile.summary);
  const [experiences, setExperiences] = useState<Experience[]>(profile.experiences);
  const [projects, setProjects] = useState<Project[]>(profile.projects);
  const [education, setEducation] = useState<Education[]>(profile.education);
  const [skills, setSkills] = useState<SkillGroup[]>(profile.skills);
  const [certifications, setCertifications] = useState<Certification[]>(profile.certifications);
  const [saving, setSaving] = useState(false);

  // Two-stage open: mount with translate-x-full, then flip on next frame so the
  // transition animates. Closing reverses that for a smooth slide-out.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Esc to close (uses the animated close).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [handleClose]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    let payload: Partial<ProfileLike>;
    switch (section) {
      case "personal":      payload = { contact, summary }; break;
      case "experience":    payload = { experiences }; break;
      case "projects":      payload = { projects }; break;
      case "education":     payload = { education }; break;
      case "skills":        payload = { skills }; break;
      case "certifications": payload = { certifications }; break;
    }
    try {
      const updated = (await masterProfileAPI.update(payload)) as unknown as ProfileLike;
      onSaved(updated);
      toast.success(`${SECTION_TITLE[section]} updated`);
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Could not save changes");
    } finally {
      setSaving(false);
    }
  }, [section, contact, summary, experiences, projects, education, skills, certifications, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" onClick={handleClose}>
      <div
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      />
      <aside
        className={`relative h-full bg-card shadow-2xl flex flex-col border-l border-border transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: "min(720px, 100vw - 12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h2 className="text-base font-semibold text-foreground">{SECTION_TITLE[section]}</h2>
          </div>
          <button onClick={onSave} disabled={saving} className="px-4 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:brightness-110 rounded-full disabled:opacity-60">
            {saving ? "Saving…" : "Update"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {section === "personal" && (
            <PersonalForm contact={contact} setContact={setContact} summary={summary} setSummary={setSummary} />
          )}
          {section === "experience" && (
            <ListEditor
              items={experiences}
              setItems={setExperiences}
              label="Experience"
              addBlank={blank.experience}
              renderItem={(item, update) => <ExperienceItem item={item} update={update} />}
              title={(it) => it.role || it.company || "New role"}
            />
          )}
          {section === "projects" && (
            <ListEditor
              items={projects}
              setItems={setProjects}
              label="Project"
              addBlank={blank.project}
              renderItem={(item, update) => <ProjectItem item={item} update={update} />}
              title={(it) => it.name || "New project"}
            />
          )}
          {section === "education" && (
            <ListEditor
              items={education}
              setItems={setEducation}
              label="Education"
              addBlank={blank.education}
              renderItem={(item, update) => <EducationItem item={item} update={update} />}
              title={(it) => it.school || "New entry"}
            />
          )}
          {section === "skills" && (
            <ListEditor
              items={skills}
              setItems={setSkills}
              label="Skill group"
              addBlank={blank.skillGroup}
              renderItem={(item, update) => <SkillGroupItem item={item} update={update} />}
              title={(it) => it.category || "New group"}
            />
          )}
          {section === "certifications" && (
            <ListEditor
              items={certifications}
              setItems={setCertifications}
              label="Certification"
              addBlank={blank.certification}
              renderItem={(item, update) => <CertificationItem item={item} update={update} />}
              title={(it) => it.name || "New certification"}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================== */
/* Generic helpers                                                */
/* ============================================================== */

const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-shadow";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-foreground mb-1.5">
        {required && <span className="text-red-500 mr-1">*</span>}{label}
      </span>
      {children}
    </label>
  );
}

function ListEditor<T>({
  items, setItems, label, addBlank, renderItem, title,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  label: string;
  addBlank: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  title: (item: T) => string;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);

  const update = (idx: number, patch: Partial<T>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const copy = items.slice();
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    setItems(copy);
    setExpanded(next);
  };
  const add = () => {
    setItems([...items, addBlank()]);
    setExpanded(items.length);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = expanded === i;
        return (
          <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary truncate text-left flex-1"
              >
                <span className={`text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                <span className="truncate">{label} {i + 1} — {title(item)}</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button onClick={() => remove(i)} title="Remove" className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="p-4 space-y-3 border-t border-border">
                {renderItem(item, (patch) => update(i, patch))}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="w-full py-2.5 text-sm font-medium text-primary border border-dashed border-border rounded-lg hover:bg-primary/5"
      >
        + Add {label.toLowerCase()}
      </button>
    </div>
  );
}

function BulletList({
  bullets, onChange,
}: {
  bullets: Bullet[];
  onChange: (next: Bullet[]) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-foreground">Bullets</span>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-muted-foreground mt-2 text-xs">•</span>
          <textarea
            value={b.text}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            rows={2}
            className={`${inputCls} flex-1 resize-y`}
            placeholder="Bullet text"
          />
          <button
            type="button"
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            className="w-7 h-7 mt-1 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 shrink-0"
            aria-label="Remove bullet"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...bullets, { text: "", tags: [] }])}
        className="text-xs font-medium text-primary hover:underline"
      >
        + Add bullet
      </button>
    </div>
  );
}

/* ============================================================== */
/* Section-specific forms                                         */
/* ============================================================== */

function PersonalForm({
  contact, setContact, summary, setSummary,
}: {
  contact: Contact; setContact: (c: Contact) => void;
  summary: string; setSummary: (s: string) => void;
}) {
  const upd = (patch: Partial<Contact>) => setContact({ ...contact, ...patch });
  return (
    <div className="space-y-4">
      <Field label="Full name" required>
        <input className={inputCls} value={contact.fullName} onChange={(e) => upd({ fullName: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Email"><input className={inputCls} value={contact.email} onChange={(e) => upd({ email: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={contact.phone} onChange={(e) => upd({ phone: e.target.value })} /></Field>
        <Field label="Location"><input className={inputCls} value={contact.location} onChange={(e) => upd({ location: e.target.value })} /></Field>
        <Field label="LinkedIn"><input className={inputCls} value={contact.linkedin} onChange={(e) => upd({ linkedin: e.target.value })} /></Field>
        <Field label="GitHub"><input className={inputCls} value={contact.github} onChange={(e) => upd({ github: e.target.value })} /></Field>
        <Field label="Portfolio"><input className={inputCls} value={contact.portfolio} onChange={(e) => upd({ portfolio: e.target.value })} /></Field>
      </div>
      <Field label="Summary">
        <textarea rows={5} className={`${inputCls} resize-y`} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
    </div>
  );
}

function ExperienceItem({ item, update }: { item: Experience; update: (p: Partial<Experience>) => void }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Role" required><input className={inputCls} value={item.role} onChange={(e) => update({ role: e.target.value })} /></Field>
        <Field label="Company" required><input className={inputCls} value={item.company} onChange={(e) => update({ company: e.target.value })} /></Field>
        <Field label="Location"><input className={inputCls} value={item.location} onChange={(e) => update({ location: e.target.value })} /></Field>
        <Field label="Start date"><input className={inputCls} placeholder="YYYY-MM" value={item.startDate} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="End date">
          <input className={inputCls} placeholder="YYYY-MM" value={item.endDate} disabled={item.current} onChange={(e) => update({ endDate: e.target.value })} />
        </Field>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="rounded border-border" checked={item.current} onChange={(e) => update({ current: e.target.checked, endDate: e.target.checked ? "" : item.endDate })} />
        I currently work here
      </label>
      <BulletList bullets={item.bullets} onChange={(next) => update({ bullets: next })} />
    </>
  );
}

function ProjectItem({ item, update }: { item: Project; update: (p: Partial<Project>) => void }) {
  return (
    <>
      <Field label="Project name" required>
        <input className={inputCls} value={item.name} onChange={(e) => update({ name: e.target.value })} />
      </Field>
      <Field label="URL">
        <input className={inputCls} value={item.url} onChange={(e) => update({ url: e.target.value })} />
      </Field>
      <Field label="Short description">
        <textarea rows={2} className={`${inputCls} resize-y`} value={item.description} onChange={(e) => update({ description: e.target.value })} />
      </Field>
      <Field label="Technologies (comma-separated)">
        <input
          className={inputCls}
          value={item.technologies.join(", ")}
          onChange={(e) => update({ technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      <BulletList bullets={item.bullets} onChange={(next) => update({ bullets: next })} />
    </>
  );
}

function EducationItem({ item, update }: { item: Education; update: (p: Partial<Education>) => void }) {
  return (
    <>
      <Field label="School name" required>
        <input className={inputCls} value={item.school} onChange={(e) => update({ school: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Degree"><input className={inputCls} value={item.degree} onChange={(e) => update({ degree: e.target.value })} /></Field>
        <Field label="Field"><input className={inputCls} value={item.field} onChange={(e) => update({ field: e.target.value })} /></Field>
        <Field label="Location"><input className={inputCls} value={item.location} onChange={(e) => update({ location: e.target.value })} /></Field>
        <Field label="GPA"><input className={inputCls} value={item.gpa} onChange={(e) => update({ gpa: e.target.value })} /></Field>
        <Field label="Start date"><input className={inputCls} placeholder="YYYY-MM" value={item.startDate} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="End date"><input className={inputCls} placeholder="YYYY-MM" value={item.endDate} onChange={(e) => update({ endDate: e.target.value })} /></Field>
      </div>
      <Field label="Highlights (one per line)">
        <textarea
          rows={3}
          className={`${inputCls} resize-y`}
          value={item.highlights.join("\n")}
          onChange={(e) => update({ highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
    </>
  );
}

function SkillGroupItem({ item, update }: { item: SkillGroup; update: (p: Partial<SkillGroup>) => void }) {
  return (
    <>
      <Field label="Category" required>
        <input className={inputCls} value={item.category} onChange={(e) => update({ category: e.target.value })} placeholder="e.g. Languages, Frameworks" />
      </Field>
      <Field label="Items (comma-separated)">
        <textarea
          rows={3}
          className={`${inputCls} resize-y`}
          value={item.items.join(", ")}
          onChange={(e) => update({ items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
    </>
  );
}

function CertificationItem({ item, update }: { item: Certification; update: (p: Partial<Certification>) => void }) {
  return (
    <>
      <Field label="Name" required><input className={inputCls} value={item.name} onChange={(e) => update({ name: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Issuer"><input className={inputCls} value={item.issuer} onChange={(e) => update({ issuer: e.target.value })} /></Field>
        <Field label="Date"><input className={inputCls} value={item.date} onChange={(e) => update({ date: e.target.value })} /></Field>
      </div>
      <Field label="URL"><input className={inputCls} value={item.url} onChange={(e) => update({ url: e.target.value })} /></Field>
    </>
  );
}

