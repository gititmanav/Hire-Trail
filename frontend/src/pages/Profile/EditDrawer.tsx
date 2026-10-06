/** A side panel (ui/Drawer) for editing one Master Profile section. All edits
 *  stay client-side until "Update" is clicked; then we PUT the changed section
 *  keys back to the master profile and the panel slides away. */
import { useCallback, useState, type ReactNode } from "react";
import { ChevronRight, ChevronUp, ChevronDown, Trash2, X } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { masterProfileAPI } from "../../utils/api.ts";
import { Drawer, DrawerBody, DrawerHeader, useDrawerClose } from "../../components/ui/Drawer.tsx";
import { TextAreaField, TextField, Textarea } from "../../components/ui/Field.tsx";
import { CheckboxMark } from "../../components/ui/Checkbox.tsx";
import Button from "../../components/ui/Button.tsx";

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

  /** True once saved — the Update button then slides the panel away. */
  const onSave = useCallback(async (): Promise<boolean> => {
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
      return true;
    } catch {
      // The API layer's toast says why.
      return false;
    } finally {
      setSaving(false);
    }
  }, [section, contact, summary, experiences, projects, education, skills, certifications, onSaved]);

  return (
    <Drawer onClose={onClose} width={720}>
      <DrawerHeader title={SECTION_TITLE[section]} actions={<UpdateButton saving={saving} onSave={onSave} />} />
      <DrawerBody>
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
      </DrawerBody>
    </Drawer>
  );
}

/** Saves, then closes the panel the animated way. */
function UpdateButton({ saving, onSave }: { saving: boolean; onSave: () => Promise<boolean> }) {
  const close = useDrawerClose();
  return (
    <Button variant="primary" size="sm" loading={saving} onClick={async () => { if (await onSave()) close(); }}>
      Update
    </Button>
  );
}

/* ============================================================== */
/* Generic helpers                                                */
/* ============================================================== */

function ListEditor<T>({
  items, setItems, label, addBlank, renderItem, title,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  label: string;
  addBlank: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
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
          <div key={i} className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-control/40">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary truncate text-left flex-1"
              >
                <ChevronRight size={14} strokeWidth={2} aria-hidden className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                <span className="truncate">{label} {i + 1} — {title(item)}</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                  <ChevronUp size={13} strokeWidth={2} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down" className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                  <ChevronDown size={13} strokeWidth={2} />
                </button>
                <button onClick={() => remove(i)} title="Remove" className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600">
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="px-5 py-4 space-y-4 border-t border-border">
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
      <span className="block text-[12.5px] font-medium text-muted-foreground">Bullets</span>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="text-muted-foreground leading-relaxed text-sm" aria-hidden>•</span>
          <Textarea
            value={b.text}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            rows={1}
            className="flex-1 !min-h-0"
            aria-label={`Bullet ${i + 1}`}
            placeholder="What you did, and what it changed"
          />
          <button
            type="button"
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            className="w-7 h-7 -mt-0.5 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 shrink-0"
            aria-label="Remove bullet"
          >
            <X size={13} strokeWidth={2} />
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
      <TextField label="Full name" required value={contact.fullName} onChange={(e) => upd({ fullName: e.target.value })} placeholder="Ada Lovelace" />
      <div className={GRID}>
        <TextField label="Email" type="email" value={contact.email} onChange={(e) => upd({ email: e.target.value })} placeholder="ada@example.com" />
        <TextField label="Phone" type="tel" value={contact.phone} onChange={(e) => upd({ phone: e.target.value })} placeholder="(555) 010-0199" />
        <TextField label="Location" value={contact.location} onChange={(e) => upd({ location: e.target.value })} placeholder="Boston, MA" />
        <TextField label="LinkedIn" value={contact.linkedin} onChange={(e) => upd({ linkedin: e.target.value })} placeholder="linkedin.com/in/you" />
        <TextField label="GitHub" value={contact.github} onChange={(e) => upd({ github: e.target.value })} placeholder="github.com/you" />
        <TextField label="Portfolio" value={contact.portfolio} onChange={(e) => upd({ portfolio: e.target.value })} placeholder="you.dev" />
      </div>
      <TextAreaField label="Summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Two or three lines on what you do best" />
    </div>
  );
}

/** Two columns on a wide panel; the gap leaves room for a plain field's fill. */
const GRID = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4";

function ExperienceItem({ item, update }: { item: Experience; update: (p: Partial<Experience>) => void }) {
  return (
    <>
      <div className={GRID}>
        <TextField label="Role" required value={item.role} onChange={(e) => update({ role: e.target.value })} placeholder="Software Engineer" />
        <TextField label="Company" required value={item.company} onChange={(e) => update({ company: e.target.value })} placeholder="Stripe" />
        <TextField label="Location" value={item.location} onChange={(e) => update({ location: e.target.value })} placeholder="Remote" />
        <TextField label="Start date" value={item.startDate} onChange={(e) => update({ startDate: e.target.value })} placeholder="2024-06" />
        <TextField
          label="End date"
          value={item.endDate}
          disabled={item.current}
          onChange={(e) => update({ endDate: e.target.value })}
          placeholder={item.current ? "Present" : "2025-05"}
        />
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.current}
        onClick={() => update({ current: !item.current, endDate: !item.current ? "" : item.endDate })}
        className="inline-flex items-center gap-2 text-sm text-foreground rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CheckboxMark checked={item.current} />
        I currently work here
      </button>
      <BulletList bullets={item.bullets} onChange={(next) => update({ bullets: next })} />
    </>
  );
}

function ProjectItem({ item, update }: { item: Project; update: (p: Partial<Project>) => void }) {
  return (
    <>
      <TextField label="Project name" required value={item.name} onChange={(e) => update({ name: e.target.value })} placeholder="Realtime chat app" />
      <TextField label="URL" value={item.url} onChange={(e) => update({ url: e.target.value })} placeholder="github.com/you/project" />
      <TextAreaField label="Short description" rows={2} value={item.description} onChange={(e) => update({ description: e.target.value })} placeholder="One line on what it does" />
      <TextField
        label="Technologies (comma-separated)"
        value={item.technologies.join(", ")}
        onChange={(e) => update({ technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="React, Node, Postgres"
      />
      <BulletList bullets={item.bullets} onChange={(next) => update({ bullets: next })} />
    </>
  );
}

function EducationItem({ item, update }: { item: Education; update: (p: Partial<Education>) => void }) {
  return (
    <>
      <TextField label="School name" required value={item.school} onChange={(e) => update({ school: e.target.value })} placeholder="State University" />
      <div className={GRID}>
        <TextField label="Degree" value={item.degree} onChange={(e) => update({ degree: e.target.value })} placeholder="B.S." />
        <TextField label="Field" value={item.field} onChange={(e) => update({ field: e.target.value })} placeholder="Computer Science" />
        <TextField label="Location" value={item.location} onChange={(e) => update({ location: e.target.value })} placeholder="Boston, MA" />
        <TextField label="GPA" value={item.gpa} onChange={(e) => update({ gpa: e.target.value })} placeholder="3.8" />
        <TextField label="Start date" value={item.startDate} onChange={(e) => update({ startDate: e.target.value })} placeholder="2021-09" />
        <TextField label="End date" value={item.endDate} onChange={(e) => update({ endDate: e.target.value })} placeholder="2025-05" />
      </div>
      <TextAreaField
        label="Highlights (one per line)"
        rows={3}
        value={item.highlights.join("\n")}
        onChange={(e) => update({ highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        placeholder={"Dean's list\nTeaching assistant, Algorithms"}
      />
    </>
  );
}

function SkillGroupItem({ item, update }: { item: SkillGroup; update: (p: Partial<SkillGroup>) => void }) {
  return (
    <>
      <TextField label="Category" required value={item.category} onChange={(e) => update({ category: e.target.value })} placeholder="e.g. Languages, Frameworks" />
      <TextAreaField
        label="Items (comma-separated)"
        rows={2}
        value={item.items.join(", ")}
        onChange={(e) => update({ items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="TypeScript, Python, Go"
      />
    </>
  );
}

function CertificationItem({ item, update }: { item: Certification; update: (p: Partial<Certification>) => void }) {
  return (
    <>
      <TextField label="Name" required value={item.name} onChange={(e) => update({ name: e.target.value })} placeholder="AWS Solutions Architect" />
      <div className={GRID}>
        <TextField label="Issuer" value={item.issuer} onChange={(e) => update({ issuer: e.target.value })} placeholder="Amazon Web Services" />
        <TextField label="Date" value={item.date} onChange={(e) => update({ date: e.target.value })} placeholder="2024-03" />
      </div>
      <TextField label="URL" value={item.url} onChange={(e) => update({ url: e.target.value })} placeholder="credly.com/badges/…" />
    </>
  );
}
