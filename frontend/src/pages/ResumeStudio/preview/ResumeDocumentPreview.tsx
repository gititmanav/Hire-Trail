/**
 * ResumeDocumentPreview — the live preview that IS the print template.
 *
 * Renders `.resume-doc` from the shared ResumeDocument + injects buildResumeCss
 * (the same CSS the PDF uses). Hovering a section/entry reveals a floating
 * "Edit With AI" control (data-rd-control — stripped at serialize time); clicking
 * selects that scope for the AI Rewrite tab. Text whose path is in `changedPaths`
 * gets the transient green highlight after a rewrite.
 *
 * The page reads this component's forwarded ref (the `.resume-doc` node) to
 * serialize HTML for Download — so PDF ≡ preview.
 */
import { forwardRef } from "react";
import { Sparkles } from "lucide-react";
import {
  bulletPath, entryFieldPath, sectionTitlePath, formatResumeDate,
  type ResumeDocument, type ResumeSection, type ResumeEntry, type RewriteScope,
} from "../../../utils/resumeDocument.ts";
import { buildResumeCss, resumeRootClass, resumeRootStyle } from "./resumeCss.ts";

interface Props {
  doc: ResumeDocument;
  /** "fit to one page" density multiplier (1 = normal). */
  density?: number;
  changedPaths: Set<string>;
  /** key of the currently AI-targeted node: `${sid}` or `${sid}:${eid}`. */
  activeTargetKey?: string | null;
  onSelectTarget?: (scope: RewriteScope, label: string) => void;
  /** When false, hides the hover "Edit With AI" controls (e.g. read-only preview). */
  interactive?: boolean;
}

function changed(set: Set<string>, path: string) {
  return set.has(path) ? "rd-changed" : "";
}

function EditControl({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-rd-control
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="rd-control absolute -top-2 right-1 z-10 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-primary text-primary-foreground shadow-md opacity-0 transition-opacity"
      title={`Edit “${label}” with AI`}
    >
      <Sparkles size={12} strokeWidth={2} /> Edit With AI
    </button>
  );
}

function ContactLine({ doc }: { doc: ResumeDocument }) {
  const c = doc.meta.contact;
  const parts: React.ReactNode[] = [];
  if (c.email) parts.push(<span key="email">{c.email}</span>);
  if (c.phone) parts.push(<span key="phone">{c.phone}</span>);
  if (c.location) parts.push(<span key="loc">{c.location}</span>);
  c.links.forEach((l, i) => parts.push(<a key={`l${i}`} href={l.url.startsWith("http") ? l.url : `https://${l.url}`}>{l.label}</a>));
  return (
    <div className="rd-contact">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-2.5">
          {i > 0 && <span className="rd-contact-sep" aria-hidden>·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}

function SkillsSection({ section, doc }: { section: ResumeSection; doc: ResumeDocument }) {
  const layout = doc.style.skillsLayout;
  const lines = section.entries.flatMap((e) => e.bullets);
  const cls = layout === "grouped" ? "rd-skills-grouped" : layout === "columns" ? "rd-skills-columns" : "rd-skills-inline";
  return (
    <div className={cls}>
      {lines.map((b) => (
        <span key={b.id} className="rd-skill-line">{b.text}</span>
      ))}
    </div>
  );
}

const ResumeDocumentPreview = forwardRef<HTMLDivElement, Props>(function ResumeDocumentPreview(
  { doc, density = 1, changedPaths, activeTargetKey, onSelectTarget, interactive = true },
  ref,
) {
  const visibleSections = doc.sections.filter((s) => !s.hidden).slice().sort((a, b) => a.order - b.order);
  const css = buildResumeCss(doc.style, density);

  // Resolve education order at render (swap title/org leading line per style).
  const eduOrder = doc.style.educationOrder;

  return (
    <>
      {/* Scoped style — same string the PDF receives. */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        ref={ref}
        className={resumeRootClass(doc.style)}
        style={resumeRootStyle(doc.style)}
      >
        <header className={`rd-header rd-align-${doc.style.headerAlignment}`}>
          <h1 className={`rd-name ${changed(changedPaths, "meta.name")}`}>{doc.meta.name || "Your Name"}</h1>
          <ContactLine doc={doc} />
        </header>

        {visibleSections.map((section) => {
          const entries = section.entries.slice().sort((a, b) => a.order - b.order);
          const sectionLabel = section.title;
          return (
            <section key={section.id} className={`rd-section rd-section-wrap${activeTargetKey === section.id ? " rd-targeted" : ""}`}>
              {interactive && onSelectTarget && (
                <EditControl label={sectionLabel} onClick={() => onSelectTarget({ sectionId: section.id }, sectionLabel)} />
              )}
              <h2 className={`rd-section-title ${changed(changedPaths, sectionTitlePath(section.id))}`}>{section.title}</h2>

              {section.type === "summary" ? (
                <div className="rd-summary-block">
                  {entries.flatMap((e) => e.bullets).map((b) => (
                    <p key={b.id} className={`rd-summary ${changed(changedPaths, summaryBulletPath(section, b.id))}`}>{b.text}</p>
                  ))}
                </div>
              ) : section.type === "skills" ? (
                <SkillsSection section={section} doc={doc} />
              ) : (
                entries.map((entry) => (
                  <EntryBlockWithEduOrder
                    key={entry.id}
                    section={section}
                    entry={entry}
                    eduOrder={eduOrder}
                    changedPaths={changedPaths}
                    interactive={interactive}
                    activeTargetKey={activeTargetKey}
                    onSelectTarget={onSelectTarget}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
});

/** Find the bullet's path within a summary section (its single entry). */
function summaryBulletPath(section: ResumeSection, bulletId: string): string {
  const entry = section.entries.find((e) => e.bullets.some((b) => b.id === bulletId));
  return entry ? bulletPath(section.id, entry.id, bulletId) : "";
}

/** Wrapper that applies education order (degree vs institution leading). */
function EntryBlockWithEduOrder({
  section, entry, eduOrder, changedPaths, interactive, activeTargetKey, onSelectTarget,
}: {
  section: ResumeSection; entry: ResumeEntry; eduOrder: "degree" | "institution";
  changedPaths: Set<string>; interactive: boolean; activeTargetKey?: string | null;
  onSelectTarget?: (scope: RewriteScope, label: string) => void;
}) {
  // For education, optionally lead with the institution instead of the degree.
  const swap = section.type === "education" && eduOrder === "institution";
  const displayEntry = swap
    ? { ...entry, title: entry.org, org: entry.title }
    : entry;
  const dateFormat = "MMM yyyy";
  const start = formatResumeDate(entry.startDate, dateFormat);
  const end = entry.current ? "Present" : formatResumeDate(entry.endDate, dateFormat);
  const dates = [start, end].filter(Boolean).join(" – ");
  const key = `${section.id}:${entry.id}`;
  const label = entry.title || entry.org || "entry";
  const targeted = activeTargetKey === key;

  return (
    <div className={`rd-entry rd-section-wrap${targeted ? " rd-targeted" : ""}`}>
      {interactive && onSelectTarget && (
        <EditControl label={label} onClick={() => onSelectTarget({ sectionId: section.id, entryId: entry.id }, label)} />
      )}
      <div className="rd-entry-head">
        <div>
          <span className={`rd-entry-title ${changed(changedPaths, entryFieldPath(section.id, entry.id, swap ? "org" : "title"))}`}>{displayEntry.title}</span>
          {displayEntry.org && <span className={`rd-entry-org ${changed(changedPaths, entryFieldPath(section.id, entry.id, swap ? "title" : "org"))}`}>{displayEntry.org}</span>}
        </div>
        {(dates || entry.location) && (
          <div className="rd-entry-meta">{[entry.location, dates].filter(Boolean).join(" · ")}</div>
        )}
      </div>
      {entry.extra && <div className={`rd-entry-extra ${changed(changedPaths, entryFieldPath(section.id, entry.id, "extra"))}`}>{entry.extra}</div>}
      {entry.bullets.length > 0 && (
        <ul className="rd-bullets">
          {entry.bullets.map((b) => (
            <li key={b.id} className={changed(changedPaths, bulletPath(section.id, entry.id, b.id))}>{b.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ResumeDocumentPreview;
