/**
 * ResumeDocument — the single shared state behind the Resume Studio review step.
 *
 * The shape mirrors the backend CONTRACT exactly (see frontend/INTEGRATION.md).
 * Every editor / style / AI-rewrite surface mutates ONE ResumeDocument so the
 * live preview reflects edits immediately. The preview is also the print
 * template: Download serializes its rendered HTML+CSS to /api/resumes/render-pdf.
 *
 * Pure data + helpers only — no React, so both the API client and the pages can
 * import it without a cycle.
 */

export type ResumeSectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "custom";

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeContact {
  email: string;
  phone: string;
  location: string;
  links: ResumeLink[];
}

export interface ResumeMeta {
  name: string;
  contact: ResumeContact;
}

export interface ResumeBullet {
  id: string;
  text: string;
  order: number;
}

/**
 * Per-type structured extras — mirrors the backend's `DocEntry.extra`
 * (services/resume/types.ts). The shape is keyed by section type:
 *   - summary  → { text }
 *   - skills   → { items[] }     (one entry per group; `title` is the category)
 *   - projects → { url, technologies[], description }
 *   - education→ { gpa }
 *   - custom   → { url }         (e.g. certifications)
 * It is an OBJECT, never a string — rendering it directly would throw React #31.
 */
export interface ResumeEntryExtra {
  text?: string;
  items?: string[];
  url?: string;
  technologies?: string[];
  description?: string;
  gpa?: string;
}

export interface ResumeEntry {
  id: string;
  org: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  order: number;
  bullets: ResumeBullet[];
  /** Structured per-type extras (see ResumeEntryExtra). */
  extra?: ResumeEntryExtra;
}

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  order: number;
  entries: ResumeEntry[];
  /** Local-only flag — hidden sections are excluded from the rendered/printed
   *  document but kept in state so the user can toggle them back. */
  hidden?: boolean;
}

export type TemplateId = "standard" | "compact" | "centered";
export type HeaderAlignment = "left" | "center" | "right";
export type EducationOrder = "degree" | "institution";
export type SkillsLayout = "inline" | "grouped" | "columns";

export interface ResumeStyle {
  template: TemplateId;
  accentColor: string;
  fontFamily: string;
  fontSizes: { name: number; sectionHeader: number; subHeader: number; body: number };
  spacing: { section: number; entry: number; line: number };
  margins: { topBottom: number; sides: number };
  headerAlignment: HeaderAlignment;
  dateFormat: string;
  bulletIcon: string;
  educationOrder: EducationOrder;
  skillsLayout: SkillsLayout;
  justifyText: boolean;
}

/** scope of an AI rewrite — a section, an entry within a section, or the whole doc. */
export type RewriteScope = { sectionId?: string; entryId?: string } | "all";

export interface AISuggestion {
  id: string;
  label: string;
  instruction: string;
  scope: RewriteScope;
}

export interface ResumeDocument {
  meta: ResumeMeta;
  sections: ResumeSection[];
  style: ResumeStyle;
  /** Match score 0–10 surfaced by the AI Rewrite gauge. */
  score?: number;
  suggestions?: AISuggestion[];
  /** Monotonic version the autosave + revert flow tracks. Local mirror of the
   *  server's document version. */
  version?: number;
}

/** One row in the "See What's Changed" changelog returned by ai-rewrite. */
export interface AIChange {
  path: string;
  summary: string;
  before: string;
  after: string;
}

export interface AIRewriteResult {
  document: ResumeDocument;
  changes: AIChange[];
  changedPaths: string[];
  score: { before: number; after: number };
}

export interface AIRewriteRequest {
  scope: RewriteScope;
  instruction?: string;
  preset?: string;
}

/* ---------- keyword-gap analysis (Step 1 "See the gap") ---------- */

export type SectionFlagSeverity = "good" | "warn" | "gap";

export interface SectionFlag {
  sectionId: string;
  title: string;
  severity: SectionFlagSeverity;
  note: string;
}

export interface GapAnalysis {
  /** 0–100 keyword-coverage percentage. */
  coverage: number;
  matched: string[];
  missing: string[];
  sectionFlags: SectionFlag[];
}

/** The AI brain's per-application "fit" read (1–5 score + matched/missing
 *  skills). Surfaced on the Applications fit panel and the tailoring drawer's
 *  Step 1 header. Separate from the deterministic 0–10 match score. */
export interface FitSummary {
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "D" | "F" | "";
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
}

/* ---------- defaults ---------- */

export const DEFAULT_STYLE: ResumeStyle = {
  template: "standard",
  accentColor: "#2563eb",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSizes: { name: 24, sectionHeader: 13, subHeader: 12, body: 10.5 },
  spacing: { section: 16, entry: 10, line: 1.4 },
  margins: { topBottom: 40, sides: 48 },
  headerAlignment: "left",
  dateFormat: "MMM yyyy",
  bulletIcon: "•",
  educationOrder: "degree",
  skillsLayout: "inline",
  justifyText: false,
};

/* ---------- id + path helpers ---------- */

let idCounter = 0;
/** Stable-enough client id for new sections/entries/bullets created in the editor. */
export function newId(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export const sectionTitlePath = (sid: string) => `sections.${sid}.title`;
export const entryFieldPath = (sid: string, eid: string, field: string) =>
  `sections.${sid}.entries.${eid}.${field}`;
export const bulletPath = (sid: string, eid: string, bid: string) =>
  `sections.${sid}.entries.${eid}.bullets.${bid}.text`;
/** Path of a summary section's prose (lives in `entry.extra.text`, not a bullet).
 *  The backend rewrite reports a summary change by the bare ENTRY id, so the
 *  preview highlights it via this path (see studioApi.toDottedChangedPaths). */
export const summaryTextPath = (sid: string, eid: string) =>
  `sections.${sid}.entries.${eid}.extra.text`;
export const metaPath = (field: string) => `meta.${field}`;

/** Deep clone via structuredClone with a JSON fallback for older runtimes. */
export function cloneDoc(doc: ResumeDocument): ResumeDocument {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as ResumeDocument;
}

/** Re-number `order` fields to be contiguous after a reorder/add/delete. */
export function normalizeOrders(doc: ResumeDocument): ResumeDocument {
  doc.sections.forEach((s, si) => {
    s.order = si;
    s.entries.forEach((e, ei) => {
      e.order = ei;
      e.bullets.forEach((b, bi) => { b.order = bi; });
    });
  });
  return doc;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO-ish date string ("2023-06", "2023-06-01", "2023") per the
 *  style.dateFormat. Returns the raw string untouched when it doesn't parse —
 *  the field is free text, not a date picker. */
export function formatResumeDate(raw: string, dateFormat: string): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!m) return raw;
  const year = m[1];
  const month = m[2] ? Math.min(12, Math.max(1, parseInt(m[2], 10))) : null;
  if (!month) return year;
  const mon = MONTHS[month - 1];
  switch (dateFormat) {
    case "MM/yyyy": return `${String(month).padStart(2, "0")}/${year}`;
    case "yyyy": return year;
    case "MMMM yyyy": {
      const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1];
      return `${full} ${year}`;
    }
    case "MMM yyyy":
    default:
      return `${mon} ${year}`;
  }
}
