/**
 * Typst source generator for a single-page resume.
 *
 * Built to be:
 *   - ATS-friendly (no images, single column, real text)
 *   - One page by default (compact spacing) — Typst will overflow to a second page if
 *     the content is too long, which we detect after compile and surface as a warning.
 */
import type { IMasterProfile, IExperience, IProject, IEducation, ISkillGroup, ICertification, IContactInfo } from "../../models/MasterProfile.js";

const esc = (s: string): string =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/#/g, "\\#")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")
    .replace(/@/g, "\\@")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .trim();

const stripUrl = (s: string): string => (s || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

const dateRange = (start: string, end: string, current?: boolean): string => {
  const a = start || "";
  const b = current ? "Present" : (end || "");
  if (!a && !b) return "";
  return `${a} – ${b}`;
};

function header(c: IContactInfo): string {
  const links: string[] = [];
  if (c.email) links.push(esc(c.email));
  if (c.phone) links.push(esc(c.phone));
  if (c.location) links.push(esc(c.location));
  if (c.linkedin) links.push(esc(stripUrl(c.linkedin)));
  if (c.github) links.push(esc(stripUrl(c.github)));
  if (c.portfolio) links.push(esc(stripUrl(c.portfolio)));
  return `
#align(center)[
  #text(size: 18pt, weight: 700)[${esc(c.fullName || "Resume")}]
  #v(2pt)
  #text(size: 9pt, fill: gray.darken(20%))[${links.join(" · ")}]
]
`;
}

function sectionTitle(title: string): string {
  return `
#v(8pt)
#text(size: 10.5pt, weight: 700, tracking: 0.5pt)[${esc(title.toUpperCase())}]
#line(length: 100%, stroke: 0.5pt + black)
#v(2pt)
`;
}

function summarySection(summary: string): string {
  if (!summary) return "";
  return `${sectionTitle("Summary")}
#text(size: 9.5pt)[${esc(summary)}]
`;
}

function experienceSection(items: IExperience[]): string {
  if (items.length === 0) return "";
  const blocks = items.map((exp) => {
    const dates = dateRange(exp.startDate, exp.endDate, exp.current);
    const subLine = [exp.company, exp.location].filter(Boolean).map(esc).join(" · ");
    const bullets = exp.bullets.map((b) => `  - ${esc(b.text)}`).join("\n");
    return `
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [#text(size: 10pt, weight: 700)[${esc(exp.role || "")}]\\
   #text(size: 9pt, fill: gray.darken(15%))[${subLine}]],
  text(size: 9pt, fill: gray.darken(10%))[${esc(dates)}],
)
#set list(indent: 0.6em, body-indent: 0.4em, spacing: 2pt)
#text(size: 9.5pt)[
${bullets}
]
#v(4pt)
`;
  });
  return `${sectionTitle("Experience")}${blocks.join("")}`;
}

function projectsSection(items: IProject[]): string {
  if (items.length === 0) return "";
  const blocks = items.map((p) => {
    const sub = p.technologies.length ? p.technologies.map(esc).join(", ") : "";
    const url = stripUrl(p.url);
    const bullets = p.bullets.map((b) => `  - ${esc(b.text)}`).join("\n");
    const descLine = p.description ? `#text(size: 9.5pt)[${esc(p.description)}]\n` : "";
    return `
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [#text(size: 10pt, weight: 700)[${esc(p.name)}]${sub ? ` · #text(size: 9pt, fill: gray.darken(15%))[${sub}]` : ""}],
  ${url ? `text(size: 9pt, fill: gray.darken(10%))[${esc(url)}]` : "[]"},
)
${descLine}#set list(indent: 0.6em, body-indent: 0.4em, spacing: 2pt)
#text(size: 9.5pt)[
${bullets}
]
#v(4pt)
`;
  });
  return `${sectionTitle("Projects")}${blocks.join("")}`;
}

function educationSection(items: IEducation[]): string {
  if (items.length === 0) return "";
  const blocks = items.map((e) => {
    const degree = [e.degree, e.field].filter(Boolean).join(", ");
    const dates = dateRange(e.startDate, e.endDate);
    const extras = [e.location, e.gpa ? `GPA ${e.gpa}` : ""].filter(Boolean).map(esc).join(" · ");
    const highlights = e.highlights.length
      ? `#set list(indent: 0.6em, body-indent: 0.4em, spacing: 2pt)
#text(size: 9.5pt)[
${e.highlights.map((h) => `  - ${esc(h)}`).join("\n")}
]`
      : "";
    return `
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [#text(size: 10pt, weight: 700)[${esc(e.school)}]\\
   #text(size: 9pt, fill: gray.darken(15%))[${esc(degree)}${extras ? ` · ${extras}` : ""}]],
  text(size: 9pt, fill: gray.darken(10%))[${esc(dates)}],
)
${highlights}
#v(3pt)
`;
  });
  return `${sectionTitle("Education")}${blocks.join("")}`;
}

function skillsSection(items: ISkillGroup[]): string {
  if (items.length === 0) return "";
  const rows = items.map((g) =>
    `#text(size: 9.5pt)[*${esc(g.category)}:* ${g.items.map(esc).join(", ")}]`
  ).join("\n#v(1pt)\n");
  return `${sectionTitle("Skills")}
${rows}
`;
}

function certsSection(items: ICertification[]): string {
  if (items.length === 0) return "";
  const rows = items.map((c) => {
    const parts = [`*${esc(c.name)}*`];
    if (c.issuer) parts.push(esc(c.issuer));
    if (c.date) parts.push(esc(c.date));
    return `#text(size: 9.5pt)[${parts.join(" · ")}]`;
  }).join("\n#v(1pt)\n");
  return `${sectionTitle("Certifications")}
${rows}
`;
}

/** Build a complete Typst document from a master profile. */
export function buildResumeTypst(profile: IMasterProfile): string {
  return `
#set page(
  paper: "us-letter",
  margin: (top: 0.45in, bottom: 0.45in, left: 0.6in, right: 0.6in),
)
#set text(
  font: ("Helvetica", "Arial", "Liberation Sans", "DejaVu Sans"),
  size: 10pt,
  fill: rgb("#111"),
)
#set par(leading: 0.55em, justify: false)

${header(profile.contact)}

${summarySection(profile.summary)}

${experienceSection(profile.experiences)}

${projectsSection(profile.projects)}

${educationSection(profile.education)}

${skillsSection(profile.skills)}

${certsSection(profile.certifications)}
`;
}
