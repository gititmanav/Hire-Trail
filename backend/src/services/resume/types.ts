/**
 * The stable `ResumeDocument` shape — the contract between the backend resume
 * engine and the frontend editor. Versioned implicitly by being additive only.
 *
 * Design notes:
 *  - Every section/entry/bullet carries a stable `id` so the AI-rewrite diff can
 *    address an exact field (changedPaths) and the editor can highlight it.
 *  - `order` is explicit (not array position) so reordering is a value change,
 *    not a structural one — keeps diffs clean.
 *  - Skills don't have bullets; each skill group is an `entry` whose `title` is
 *    the category and whose items live in `extra.items: string[]`.
 *  - `score` + `suggestions` are DERIVED on read (deterministic, see score.ts /
 *    suggestions.ts) and attached to responses; they are not the source of truth.
 */

export type SectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "custom";

export interface DocLink {
  label: string;
  url: string;
}

export interface DocContact {
  email: string;
  phone: string;
  location: string;
  links: DocLink[];
}

export interface DocMeta {
  name: string;
  contact: DocContact;
}

export interface DocBullet {
  id: string;
  text: string;
  order: number;
}

export interface DocEntry {
  id: string;
  org: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  order: number;
  bullets: DocBullet[];
  /** Free-form per-type extras. For skills: { items: string[] }. For summary:
   *  { text: string }. For projects: { url, technologies }. */
  extra?: Record<string, unknown>;
}

export interface DocSection {
  id: string;
  type: SectionType;
  title: string;
  order: number;
  entries: DocEntry[];
}

export type TemplateName = "standard" | "compact" | "centered";
export type HeaderAlignment = "left" | "center" | "right";
export type EducationOrder = "degree" | "institution";
export type SkillsLayout = "inline" | "grouped" | "columns";

export interface DocStyle {
  template: TemplateName;
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

export interface RewriteScope {
  sectionId?: string;
  entryId?: string;
}

export interface SuggestionChip {
  id: string;
  label: string;
  instruction: string;
  scope: RewriteScope | "all";
}

export interface ResumeDocument {
  meta: DocMeta;
  sections: DocSection[];
  style: DocStyle;
  /** Derived deterministic match score 0–10 (see score.ts). Attached on read. */
  score?: number;
  /** Derived contextual rewrite chips (see suggestions.ts). Attached on read. */
  suggestions?: SuggestionChip[];
}

/** The default style applied to freshly-derived documents. */
export const DEFAULT_STYLE: DocStyle = {
  template: "standard",
  accentColor: "#1a1a1a",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSizes: { name: 22, sectionHeader: 12, subHeader: 11, body: 10 },
  spacing: { section: 10, entry: 6, line: 1.3 },
  margins: { topBottom: 36, sides: 44 },
  headerAlignment: "center",
  dateFormat: "MMM YYYY",
  bulletIcon: "•",
  educationOrder: "degree",
  skillsLayout: "grouped",
  justifyText: false,
};
