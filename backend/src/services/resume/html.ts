/**
 * ResumeDocument → ATS-safe HTML/CSS, and the sanitizer that locks any HTML we
 * send to Gotenberg down to a safe subset.
 *
 * ATS-safety: single column, real selectable text, no images, semantic headings.
 * Multi-page is allowed — nothing is force-fit or truncated (task 7).
 *
 * SECURITY (defense in depth — see DEPLOY_GOTENBERG.md):
 *   1. `sanitizeResumeHtml` strips <script>/<iframe>/<link>/<object>, on* event
 *      handlers, javascript: URLs, <img>, and any external resource reference;
 *      `sanitizeCss` removes @import / url() / expression().
 *   2. Gotenberg itself is configured to DENY network access, so even if a
 *      reference slipped through it cannot phone home (no SSRF).
 */
import type { ResumeDocument, DocSection, DocEntry, DocStyle } from "./types.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------- sanitization -------------------- */

const DANGEROUS_TAGS = /<\/?(script|iframe|object|embed|link|meta|base|style|img|svg|video|audio|source|track|form|input|button)\b[^>]*>/gi;
const EVENT_ATTRS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI = /(href|src|xlink:href)\s*=\s*("|')?\s*javascript:[^"'>\s]*("|')?/gi;
const EXTERNAL_REF = /\b(src|href|xlink:href|data|poster|background|action)\s*=\s*("|')?\s*(https?:|\/\/|data:|file:|ftp:)[^"'>\s]*("|')?/gi;

/** Strip everything that could execute or fetch a remote resource. Leaves the
 *  resume's structural/text markup intact. */
export function sanitizeResumeHtml(html: string): string {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_ATTRS, "")
    .replace(JS_URI, "")
    .replace(EXTERNAL_REF, "")
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, ""); // we provide our own wrapper
}

/** Remove CSS escape hatches that can load remote content or run script. */
export function sanitizeCss(css: string): string {
  return String(css || "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript:/gi, "");
}

const BASE_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;padding:0;color:#111;}
a{color:inherit;text-decoration:none;}
ul{margin:2pt 0 0 0;padding-left:14pt;}
li{margin:0 0 2pt 0;}
h1,h2,h3{margin:0;}
`;

/** Wrap sanitized body + css into a complete, self-contained HTML5 document. */
export function composeHtml(bodyHtml: string, css: string): string {
  const safeBody = sanitizeResumeHtml(bodyHtml);
  const safeCss = sanitizeCss(css);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title><style>${BASE_CSS}${safeCss}</style></head><body>${safeBody}</body></html>`;
}

/* -------------------- document → template -------------------- */

function styleToCss(style: DocStyle): string {
  const f = style.fontSizes;
  return `
@page { margin: ${style.margins.topBottom}pt ${style.margins.sides}pt; }
body { font-family: ${sanitizeCss(style.fontFamily) || "Helvetica, Arial, sans-serif"}; font-size: ${f.body}pt; line-height: ${style.spacing.line}; ${style.justifyText ? "text-align: justify;" : ""} }
.r-header { text-align: ${style.headerAlignment}; margin-bottom: ${style.spacing.section}pt; }
.r-name { font-size: ${f.name}pt; font-weight: 700; color: ${cssColor(style.accentColor)}; }
.r-contact { font-size: ${Math.max(8, f.body - 1)}pt; color: #444; margin-top: 2pt; }
.r-section { margin-top: ${style.spacing.section}pt; }
.r-section-title { font-size: ${f.sectionHeader}pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5pt; border-bottom: 1pt solid ${cssColor(style.accentColor)}; padding-bottom: 1pt; margin-bottom: ${style.spacing.entry}pt; }
.r-entry { margin-bottom: ${style.spacing.entry}pt; }
.r-entry-head { display: flex; justify-content: space-between; gap: 8pt; }
.r-entry-title { font-size: ${f.subHeader}pt; font-weight: 700; }
.r-entry-sub { font-size: ${f.body}pt; color: #333; }
.r-entry-dates { font-size: ${Math.max(8, f.body - 1)}pt; color: #555; white-space: nowrap; }
.r-skill-row { margin-bottom: 2pt; }
.r-skill-cat { font-weight: 700; }
`;
}

/** Accept only a hex/rgb-ish color; otherwise default — blocks CSS injection. */
function cssColor(c: string): string {
  return /^#[0-9a-fA-F]{3,8}$|^rgb/.test(c.trim()) ? c.trim() : "#1a1a1a";
}

function dates(e: DocEntry): string {
  const end = e.current ? "Present" : e.endDate;
  const parts = [e.startDate, end].filter(Boolean);
  return parts.join(" – ");
}

function bulletsHtml(e: DocEntry): string {
  if (!e.bullets.length) return "";
  const items = [...e.bullets].sort((a, b) => a.order - b.order).map((b) => `<li>${esc(b.text)}</li>`).join("");
  return `<ul>${items}</ul>`;
}

function sectionHtml(section: DocSection): string {
  const entries = [...section.entries].sort((a, b) => a.order - b.order);

  if (section.type === "summary") {
    const text = (entries[0]?.extra as { text?: string } | undefined)?.text ?? "";
    if (!text.trim()) return "";
    return `<div class="r-section"><div class="r-section-title">${esc(section.title)}</div><div>${esc(text)}</div></div>`;
  }

  if (section.type === "skills") {
    const rows = entries
      .map((e) => {
        const items = ((e.extra as { items?: string[] } | undefined)?.items ?? []).filter(Boolean);
        if (!items.length) return "";
        return `<div class="r-skill-row"><span class="r-skill-cat">${esc(e.title)}:</span> ${esc(items.join(", "))}</div>`;
      })
      .filter(Boolean)
      .join("");
    if (!rows) return "";
    return `<div class="r-section"><div class="r-section-title">${esc(section.title)}</div>${rows}</div>`;
  }

  const blocks = entries
    .map((e) => {
      const extra = e.extra as { url?: string; technologies?: string[]; gpa?: string; description?: string } | undefined;
      const subBits = [e.org, e.location].filter(Boolean).map(esc);
      if (extra?.technologies?.length) subBits.push(esc(extra.technologies.join(", ")));
      if (extra?.gpa) subBits.push(`GPA ${esc(extra.gpa)}`);
      const sub = subBits.join(" · ");
      const desc = extra?.description ? `<div class="r-entry-sub">${esc(extra.description)}</div>` : "";
      const d = dates(e);
      return `<div class="r-entry">
        <div class="r-entry-head">
          <div><span class="r-entry-title">${esc(e.title)}</span>${sub ? `<div class="r-entry-sub">${sub}</div>` : ""}</div>
          ${d ? `<div class="r-entry-dates">${esc(d)}</div>` : ""}
        </div>${desc}${bulletsHtml(e)}
      </div>`;
    })
    .join("");

  return `<div class="r-section"><div class="r-section-title">${esc(section.title)}</div>${blocks}</div>`;
}

/** Render a ResumeDocument to a complete, self-contained, sanitized HTML page. */
export function documentToHtml(doc: ResumeDocument): string {
  const c = doc.meta.contact;
  const contactBits = [c.email, c.phone, c.location, ...c.links.map((l) => l.label)].filter(Boolean).map(esc);
  const header = `<div class="r-header"><div class="r-name">${esc(doc.meta.name || "Resume")}</div><div class="r-contact">${contactBits.join("  ·  ")}</div></div>`;
  const sections = [...doc.sections].sort((a, b) => a.order - b.order).map(sectionHtml).join("");
  return composeHtml(`${header}${sections}`, styleToCss(doc.style));
}
