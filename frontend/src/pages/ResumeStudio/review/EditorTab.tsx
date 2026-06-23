/**
 * Editor tab — direct editing over the shared ResumeDocument. Every keystroke
 * mutates the same state the live preview renders, so edits show instantly.
 *
 *   • section: rename, show/hide, reorder (↑/↓), add, delete (ConfirmModal)
 *   • entry:   edit org/title/location/dates/current/extra; add; delete
 *   • bullet:  edit text; add; delete; reorder by drag
 */
import { useState } from "react";
import {
  ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Plus, Trash2,
} from "lucide-react";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import { newId, type ResumeSection, type ResumeEntry, type ResumeSectionType } from "../../../utils/resumeDocument.ts";
import type { StudioController } from "../useStudioDocument.ts";

const fieldCls = "w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";
const ENTRY_TYPES: ResumeSectionType[] = ["experience", "education", "projects", "custom"];
const HAS_ENTRIES = (t: ResumeSectionType) => t === "experience" || t === "education" || t === "projects" || t === "custom";

const ADD_SECTION_TYPES: { type: ResumeSectionType; label: string }[] = [
  { type: "experience", label: "Experience" },
  { type: "projects", label: "Projects" },
  { type: "education", label: "Education" },
  { type: "skills", label: "Skills" },
  { type: "summary", label: "Summary" },
  { type: "custom", label: "Custom section" },
];

export default function EditorTab({ studio }: { studio: StudioController }) {
  const { doc, applyEdit } = studio;
  const [pendingDelete, setPendingDelete] = useState<{ sid: string; title: string } | null>(null);
  const [drag, setDrag] = useState<{ sid: string; eid: string; index: number } | null>(null);

  if (!doc) return null;
  const sections = doc.sections.slice().sort((a, b) => a.order - b.order);

  /* ---- mutators ---- */
  const setSectionTitle = (sid: string, title: string) =>
    applyEdit((d) => { const s = d.sections.find((x) => x.id === sid); if (s) s.title = title; });
  const toggleHidden = (sid: string) =>
    applyEdit((d) => { const s = d.sections.find((x) => x.id === sid); if (s) s.hidden = !s.hidden; });
  const moveSection = (sid: string, dir: -1 | 1) =>
    applyEdit((d) => {
      const i = d.sections.findIndex((x) => x.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.sections.length) return;
      [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
    });
  const deleteSection = (sid: string) =>
    applyEdit((d) => { d.sections = d.sections.filter((x) => x.id !== sid); });
  const addSection = (type: ResumeSectionType, label: string) =>
    applyEdit((d) => {
      d.sections.push({
        id: newId("sec"), type, title: label, order: d.sections.length,
        entries: HAS_ENTRIES(type)
          ? [{ id: newId("e"), org: "", title: "", location: "", startDate: "", endDate: "", current: false, order: 0, bullets: [{ id: newId("b"), text: "", order: 0 }] }]
          : [{ id: newId("e"), org: "", title: "", location: "", startDate: "", endDate: "", current: false, order: 0, bullets: [{ id: newId("b"), text: "", order: 0 }] }],
      });
    });

  const setEntryField = (sid: string, eid: string, field: keyof ResumeEntry, value: string | boolean) =>
    applyEdit((d) => {
      const e = d.sections.find((x) => x.id === sid)?.entries.find((y) => y.id === eid);
      if (e) (e as unknown as Record<string, unknown>)[field] = value;
    });
  const addEntry = (sid: string) =>
    applyEdit((d) => {
      const s = d.sections.find((x) => x.id === sid);
      if (s) s.entries.push({ id: newId("e"), org: "", title: "", location: "", startDate: "", endDate: "", current: false, order: s.entries.length, bullets: [{ id: newId("b"), text: "", order: 0 }] });
    });
  const deleteEntry = (sid: string, eid: string) =>
    applyEdit((d) => { const s = d.sections.find((x) => x.id === sid); if (s) s.entries = s.entries.filter((y) => y.id !== eid); });

  const setBulletText = (sid: string, eid: string, bid: string, text: string) =>
    applyEdit((d) => {
      const e = d.sections.find((x) => x.id === sid)?.entries.find((y) => y.id === eid);
      const b = e?.bullets.find((z) => z.id === bid);
      if (b) b.text = text;
    });
  const addBullet = (sid: string, eid: string) =>
    applyEdit((d) => {
      const e = d.sections.find((x) => x.id === sid)?.entries.find((y) => y.id === eid);
      if (e) e.bullets.push({ id: newId("b"), text: "", order: e.bullets.length });
    });
  const deleteBullet = (sid: string, eid: string, bid: string) =>
    applyEdit((d) => {
      const e = d.sections.find((x) => x.id === sid)?.entries.find((y) => y.id === eid);
      if (e) e.bullets = e.bullets.filter((z) => z.id !== bid);
    });
  const reorderBullet = (sid: string, eid: string, from: number, to: number) =>
    applyEdit((d) => {
      const e = d.sections.find((x) => x.id === sid)?.entries.find((y) => y.id === eid);
      if (!e || from === to || to < 0 || to >= e.bullets.length) return;
      const [moved] = e.bullets.splice(from, 1);
      e.bullets.splice(to, 0, moved);
    });

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <SectionCard
          key={section.id}
          section={section}
          isFirst={i === 0}
          isLast={i === sections.length - 1}
          onTitle={(t) => setSectionTitle(section.id, t)}
          onToggleHidden={() => toggleHidden(section.id)}
          onMove={(dir) => moveSection(section.id, dir)}
          onDelete={() => setPendingDelete({ sid: section.id, title: section.title })}
          onAddEntry={() => addEntry(section.id)}
          onDeleteEntry={(eid) => deleteEntry(section.id, eid)}
          onEntryField={(eid, f, v) => setEntryField(section.id, eid, f, v)}
          onBulletText={(eid, bid, t) => setBulletText(section.id, eid, bid, t)}
          onAddBullet={(eid) => addBullet(section.id, eid)}
          onDeleteBullet={(eid, bid) => deleteBullet(section.id, eid, bid)}
          drag={drag}
          setDrag={setDrag}
          onReorderBullet={(eid, from, to) => reorderBullet(section.id, eid, from, to)}
        />
      ))}

      <ActionDropdown
        align="left"
        menuWidth="w-52"
        trigger={
          <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
            <Plus size={15} strokeWidth={2} /> Add section
          </button>
        }
        items={ADD_SECTION_TYPES.map((t) => ({ label: t.label, onClick: () => addSection(t.type, t.label) }))}
      />

      {pendingDelete && (
        <ConfirmModal
          title="Delete section?"
          message={`Remove the “${pendingDelete.title}” section and all its content from this resume.`}
          confirmLabel="Delete section"
          onConfirm={() => { deleteSection(pendingDelete.sid); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------- section card ---------- */

function SectionCard({
  section, isFirst, isLast,
  onTitle, onToggleHidden, onMove, onDelete,
  onAddEntry, onDeleteEntry, onEntryField,
  onBulletText, onAddBullet, onDeleteBullet,
  drag, setDrag, onReorderBullet,
}: {
  section: ResumeSection; isFirst: boolean; isLast: boolean;
  onTitle: (t: string) => void; onToggleHidden: () => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
  onAddEntry: () => void; onDeleteEntry: (eid: string) => void;
  onEntryField: (eid: string, f: keyof ResumeEntry, v: string | boolean) => void;
  onBulletText: (eid: string, bid: string, t: string) => void;
  onAddBullet: (eid: string) => void; onDeleteBullet: (eid: string, bid: string) => void;
  drag: { sid: string; eid: string; index: number } | null;
  setDrag: (d: { sid: string; eid: string; index: number } | null) => void;
  onReorderBullet: (eid: string, from: number, to: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const entries = section.entries.slice().sort((a, b) => a.order - b.order);
  const showEntryFields = section.type !== "summary" && section.type !== "skills";

  return (
    <div className={`bg-card border border-border rounded-xl ${section.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground" aria-label={open ? "Collapse" : "Expand"}>
          {open ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
        </button>
        <input
          value={section.title}
          onChange={(e) => onTitle(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold bg-transparent border border-transparent hover:border-border focus:border-ring rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          aria-label="Section title"
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">{section.type}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <IconBtn title={section.hidden ? "Show section" : "Hide section"} onClick={onToggleHidden}>
            {section.hidden ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
          </IconBtn>
          <IconBtn title="Move up" onClick={() => onMove(-1)} disabled={isFirst}><ChevronUp size={14} strokeWidth={2} /></IconBtn>
          <IconBtn title="Move down" onClick={() => onMove(1)} disabled={isLast}><ChevronDown size={14} strokeWidth={2} /></IconBtn>
          <IconBtn title="Delete section" onClick={onDelete} danger><Trash2 size={14} strokeWidth={1.8} /></IconBtn>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
              {showEntryFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <input className={fieldCls} placeholder={section.type === "education" ? "Degree" : "Title / Role"} value={entry.title} onChange={(e) => onEntryField(entry.id, "title", e.target.value)} />
                  <input className={fieldCls} placeholder={section.type === "education" ? "Institution" : "Organization"} value={entry.org} onChange={(e) => onEntryField(entry.id, "org", e.target.value)} />
                  <input className={fieldCls} placeholder="Location" value={entry.location} onChange={(e) => onEntryField(entry.id, "location", e.target.value)} />
                  <div className="flex items-center gap-2">
                    <input className={`${fieldCls} flex-1`} placeholder="Start (e.g. 2022-08)" value={entry.startDate} onChange={(e) => onEntryField(entry.id, "startDate", e.target.value)} />
                    <input className={`${fieldCls} flex-1 disabled:opacity-50`} placeholder="End" value={entry.endDate} disabled={entry.current} onChange={(e) => onEntryField(entry.id, "endDate", e.target.value)} />
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={entry.current} onChange={(e) => onEntryField(entry.id, "current", e.target.checked)} className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring" />
                    Current
                  </label>
                  <input className={fieldCls} placeholder="Extra (GPA, tech stack…)" value={entry.extra ?? ""} onChange={(e) => onEntryField(entry.id, "extra", e.target.value)} />
                </div>
              )}

              {/* bullets */}
              <ul className="space-y-1.5">
                {entry.bullets.map((b, bi) => (
                  <li
                    key={b.id}
                    draggable
                    onDragStart={() => setDrag({ sid: section.id, eid: entry.id, index: bi })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (drag && drag.sid === section.id && drag.eid === entry.id) onReorderBullet(entry.id, drag.index, bi);
                      setDrag(null);
                    }}
                    onDragEnd={() => setDrag(null)}
                    className={`flex items-start gap-1.5 group ${drag && drag.eid === entry.id && drag.index === bi ? "opacity-40" : ""}`}
                  >
                    <span className="mt-2 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder">
                      <GripVertical size={13} strokeWidth={1.8} />
                    </span>
                    <textarea
                      value={b.text}
                      onChange={(e) => onBulletText(entry.id, b.id, e.target.value)}
                      rows={1}
                      placeholder={section.type === "skills" ? "e.g. Languages: TypeScript, Python" : "Describe an accomplishment…"}
                      className="flex-1 px-2.5 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring resize-y leading-relaxed"
                    />
                    <button
                      onClick={() => onDeleteBullet(entry.id, b.id)}
                      className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete bullet"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between mt-2">
                <button onClick={() => onAddBullet(entry.id)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Plus size={12} strokeWidth={2.5} /> Add bullet
                </button>
                {showEntryFields && (
                  <button onClick={() => onDeleteEntry(entry.id)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-red-500">
                    <Trash2 size={12} strokeWidth={1.8} /> Remove entry
                  </button>
                )}
              </div>
            </div>
          ))}

          {showEntryFields && (
            <button onClick={onAddEntry} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <Plus size={13} strokeWidth={2} /> Add entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "text-muted-foreground hover:text-red-500 hover:bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
