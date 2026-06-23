/**
 * Derive a structured `ResumeDocument` from the master profile (+ accepted tailor
 * suggestions). Mapping rules:
 *   - summary       → one entry holding the text in `extra.text`
 *   - experience    → org=company, title=role, bullets verbatim
 *   - projects      → title=name, extra={url,technologies,description}
 *   - education     → org=school, title="degree, field", highlights→bullets, extra={gpa}
 *   - skills        → one entry per group: title=category, extra.items=string[]
 *   - certifications→ "custom" section, one entry per cert
 *
 * IDs are positional + stable for a given input ("s1", "s1e1", "s1e1b1"), so the
 * editor and the AI-rewrite diff can address any field. Once stored, the doc is
 * mutated in place, so these ids persist across edits.
 *
 * Keeps ALL master content — nothing is dropped (task 7).
 */
import type { IMasterProfile } from "../../models/MasterProfile.js";
import type { ITailorSuggestion } from "../../models/TailorSession.js";
import { applyAcceptedSuggestions } from "../pdf/applySuggestions.js";
import {
  type ResumeDocument,
  type DocSection,
  type DocEntry,
  type DocStyle,
  DEFAULT_STYLE,
} from "./types.js";

function freshDoc(): { nextSection: () => string } {
  let s = 0;
  return { nextSection: () => `s${++s}` };
}

function entryId(sectionId: string, i: number): string {
  return `${sectionId}e${i + 1}`;
}
function bulletId(eid: string, i: number): string {
  return `${eid}b${i + 1}`;
}

interface BuildOpts {
  suggestions?: ITailorSuggestion[];
  style?: Partial<DocStyle>;
  jdKeywords?: string[];
}

export function buildResumeDocument(master: IMasterProfile, opts: BuildOpts = {}): ResumeDocument {
  // Apply accepted suggestions onto a clone first (never mutates the master).
  const profile = opts.suggestions?.length
    ? applyAcceptedSuggestions(master, opts.suggestions)
    : master;

  const ids = freshDoc();
  const sections: DocSection[] = [];
  let order = 0;

  // --- summary ---
  if (profile.summary?.trim()) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "summary",
      title: "Summary",
      order: order++,
      entries: [
        {
          id: entryId(sid, 0),
          org: "",
          title: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          order: 0,
          bullets: [],
          extra: { text: profile.summary.trim() },
        },
      ],
    });
  }

  // --- experience ---
  if (profile.experiences.length) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "experience",
      title: "Experience",
      order: order++,
      entries: profile.experiences.map((exp, i): DocEntry => {
        const eid = entryId(sid, i);
        return {
          id: eid,
          org: exp.company || "",
          title: exp.role || "",
          location: exp.location || "",
          startDate: exp.startDate || "",
          endDate: exp.endDate || "",
          current: !!exp.current,
          order: i,
          bullets: exp.bullets.map((b, j) => ({ id: bulletId(eid, j), text: b.text, order: j })),
        };
      }),
    });
  }

  // --- projects ---
  if (profile.projects.length) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "projects",
      title: "Projects",
      order: order++,
      entries: profile.projects.map((p, i): DocEntry => {
        const eid = entryId(sid, i);
        return {
          id: eid,
          org: "",
          title: p.name || "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          order: i,
          bullets: p.bullets.map((b, j) => ({ id: bulletId(eid, j), text: b.text, order: j })),
          extra: { url: p.url || "", technologies: p.technologies || [], description: p.description || "" },
        };
      }),
    });
  }

  // --- education ---
  if (profile.education.length) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "education",
      title: "Education",
      order: order++,
      entries: profile.education.map((e, i): DocEntry => {
        const eid = entryId(sid, i);
        const title = [e.degree, e.field].filter(Boolean).join(", ");
        return {
          id: eid,
          org: e.school || "",
          title,
          location: e.location || "",
          startDate: e.startDate || "",
          endDate: e.endDate || "",
          current: false,
          order: i,
          bullets: (e.highlights || []).map((h, j) => ({ id: bulletId(eid, j), text: h, order: j })),
          extra: { gpa: e.gpa || "" },
        };
      }),
    });
  }

  // --- skills ---
  if (profile.skills.length) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "skills",
      title: "Skills",
      order: order++,
      entries: profile.skills.map((g, i): DocEntry => ({
        id: entryId(sid, i),
        org: "",
        title: g.category || "Skills",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
        order: i,
        bullets: [],
        extra: { items: g.items || [] },
      })),
    });
  }

  // --- certifications (custom) ---
  if (profile.certifications.length) {
    const sid = ids.nextSection();
    sections.push({
      id: sid,
      type: "custom",
      title: "Certifications",
      order: order++,
      entries: profile.certifications.map((c, i): DocEntry => ({
        id: entryId(sid, i),
        org: c.issuer || "",
        title: c.name || "",
        location: "",
        startDate: "",
        endDate: c.date || "",
        current: false,
        order: i,
        bullets: [],
        extra: { url: c.url || "" },
      })),
    });
  }

  const c = profile.contact;
  const links = [
    c.linkedin ? { label: "LinkedIn", url: c.linkedin } : null,
    c.github ? { label: "GitHub", url: c.github } : null,
    c.portfolio ? { label: "Portfolio", url: c.portfolio } : null,
  ].filter(Boolean) as { label: string; url: string }[];

  return {
    meta: {
      name: c.fullName || "",
      contact: { email: c.email || "", phone: c.phone || "", location: c.location || "", links },
    },
    sections,
    style: { ...DEFAULT_STYLE, ...(opts.style || {}) },
  };
}
