/**
 * buildResumeCss — the single source of truth for the resume's visual style.
 *
 * The same CSS string styles BOTH the on-screen live preview AND the PDF: at
 * Download we serialize the preview's `.resume-doc` outerHTML + this CSS and
 * POST it to /api/resumes/render-pdf, so the PDF is byte-for-byte the preview.
 *
 * Everything is scoped under `.resume-doc` so injecting it inline never leaks
 * into the app chrome. Style values are baked into a `.resume-doc { --rd-* }`
 * block; an optional `density` multiplier powers the (non-destructive) "fit to
 * one page" toggle by scaling spacing + font sizes without touching content.
 */
import type { ResumeStyle } from "../../../utils/resumeDocument.ts";

export function buildResumeCss(style: ResumeStyle, density = 1): string {
  const s = style;
  const d = density;
  const name = (s.fontSizes.name * d).toFixed(2);
  const section = (s.fontSizes.sectionHeader * d).toFixed(2);
  const sub = (s.fontSizes.subHeader * d).toFixed(2);
  const body = (s.fontSizes.body * d).toFixed(2);
  const spSection = (s.spacing.section * d).toFixed(2);
  const spEntry = (s.spacing.entry * d).toFixed(2);
  const line = s.spacing.line.toFixed(2);
  const mTb = (s.margins.topBottom * d).toFixed(2);
  const mSide = (s.margins.sides * d).toFixed(2);

  return `
.resume-doc {
  --rd-accent: ${s.accentColor};
  --rd-font: ${s.fontFamily};
  --rd-name: ${name}pt;
  --rd-section: ${section}pt;
  --rd-sub: ${sub}pt;
  --rd-body: ${body}pt;
  --rd-sp-section: ${spSection}px;
  --rd-sp-entry: ${spEntry}px;
  --rd-line: ${line};
  --rd-m-tb: ${mTb}px;
  --rd-m-side: ${mSide}px;
  font-family: var(--rd-font);
  color: #1a1a1a;
  background: #ffffff;
  line-height: var(--rd-line);
  font-size: var(--rd-body);
  padding: var(--rd-m-tb) var(--rd-m-side);
  box-sizing: border-box;
}
.resume-doc * { box-sizing: border-box; }

/* Header */
.resume-doc .rd-header { margin-bottom: var(--rd-sp-section); }
.resume-doc .rd-header.rd-align-center { text-align: center; }
.resume-doc .rd-header.rd-align-right { text-align: right; }
.resume-doc .rd-name {
  font-size: var(--rd-name);
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 4px 0;
  color: #111;
}
.resume-doc .rd-contact {
  font-size: calc(var(--rd-body) * 0.96);
  color: #444;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.resume-doc .rd-header.rd-align-center .rd-contact { justify-content: center; }
.resume-doc .rd-header.rd-align-right .rd-contact { justify-content: flex-end; }
.resume-doc .rd-contact a { color: var(--rd-accent); text-decoration: none; }
.resume-doc .rd-contact-sep { color: #bbb; }

/* Section */
.resume-doc .rd-section { margin-bottom: var(--rd-sp-section); }
.resume-doc .rd-section:last-child { margin-bottom: 0; }
.resume-doc .rd-section-title {
  font-size: var(--rd-section);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--rd-accent);
  border-bottom: 1.5px solid var(--rd-accent);
  padding-bottom: 2px;
  margin: 0 0 calc(var(--rd-sp-entry) * 0.8) 0;
}
.resume-doc.rd-tpl-centered .rd-section-title { text-align: center; border-bottom-color: rgba(0,0,0,0.12); }

/* Entry */
.resume-doc .rd-entry { margin-bottom: var(--rd-sp-entry); }
.resume-doc .rd-entry:last-child { margin-bottom: 0; }
.resume-doc .rd-entry-head {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
}
.resume-doc .rd-entry-title { font-size: var(--rd-sub); font-weight: 700; color: #111; }
.resume-doc .rd-entry-org { font-size: var(--rd-sub); font-weight: 600; color: #333; }
.resume-doc .rd-entry-org::before { content: " — "; color: #999; font-weight: 400; }
.resume-doc .rd-entry-meta { font-size: calc(var(--rd-body) * 0.94); color: #666; white-space: nowrap; }
.resume-doc .rd-entry-extra { font-size: calc(var(--rd-body) * 0.96); color: #555; font-style: italic; margin-top: 1px; }

/* Bullets */
.resume-doc .rd-bullets { list-style: none; margin: 3px 0 0 0; padding: 0; }
.resume-doc .rd-bullets li {
  position: relative;
  padding-left: 14px;
  margin-bottom: 2px;
}
.resume-doc .rd-bullets li::before {
  content: var(--rd-bullet, "•");
  position: absolute; left: 0; top: 0;
  color: var(--rd-accent);
}
.resume-doc.rd-justify .rd-bullets li { text-align: justify; }

/* Summary paragraph (a bulletless block) */
.resume-doc .rd-summary { margin: 0; }
.resume-doc.rd-justify .rd-summary { text-align: justify; }

/* Skills layouts */
.resume-doc .rd-skills-inline { display: flex; flex-wrap: wrap; gap: 2px 6px; }
.resume-doc .rd-skills-inline .rd-skill-line:not(:last-child)::after { content: " · "; color: #bbb; }
.resume-doc .rd-skills-grouped .rd-skill-line { display: block; margin-bottom: 2px; }
.resume-doc .rd-skills-columns { column-count: 2; column-gap: 24px; }
.resume-doc .rd-skills-columns .rd-skill-line { display: block; break-inside: avoid; margin-bottom: 2px; }

/* Compact template tightens vertical rhythm a touch more. */
.resume-doc.rd-tpl-compact .rd-section { margin-bottom: calc(var(--rd-sp-section) * 0.7); }
.resume-doc.rd-tpl-compact .rd-entry { margin-bottom: calc(var(--rd-sp-entry) * 0.7); }
`.trim();
}

/** Inline custom properties that can't live in the static CSS block (the bullet
 *  glyph is content, so it must be a CSS var set on the element). */
export function resumeRootStyle(style: ResumeStyle): React.CSSProperties {
  return { ["--rd-bullet" as string]: `"${style.bulletIcon || "•"}"` } as React.CSSProperties;
}

export function resumeRootClass(style: ResumeStyle): string {
  return [
    "resume-doc",
    `rd-tpl-${style.template}`,
    style.justifyText ? "rd-justify" : "",
  ].filter(Boolean).join(" ");
}
