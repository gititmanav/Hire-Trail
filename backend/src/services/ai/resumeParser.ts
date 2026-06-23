/**
 * PDF resume → structured ResumeProfile via LLM (task 5: robust + richer).
 *
 * Pipeline:
 *   1. Extract text (services/ai/pdfText.ts). Scanned/image-only PDFs are
 *      detected and surfaced as a clear, actionable error.
 *   2. Parse:
 *        - short/normal resumes → one "fast" generateObject (content-cached)
 *        - long resumes (multi-page dumps) → split into chunks, parse each, then
 *          deterministically merge so nothing is dropped and we stay within
 *          context limits.
 *   3. Completeness/sparse guard: if a multi-page resume yields too few bullets,
 *      or the result has no usable content, re-parse the whole document with the
 *      stronger "smart" model and keep whichever result is richer.
 *
 * The structured output is validated against `resumeProfileSchema` by the SDK,
 * so callers always get a typed, defaulted profile.
 */
import { z } from "zod";
import type mongoose from "mongoose";

import { runGenerateObject } from "./run.js";
import { extractPdfText } from "./pdfText.js";

const bulletSchema = z.object({
  text: z.string(),
  tags: z.array(z.string()).default([]),
});

const experienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false),
  bullets: z.array(bulletSchema).default([]),
});

const projectSchema = z.object({
  name: z.string(),
  url: z.string().default(""),
  description: z.string().default(""),
  bullets: z.array(bulletSchema).default([]),
  technologies: z.array(z.string()).default([]),
});

const educationSchema = z.object({
  school: z.string(),
  degree: z.string().default(""),
  field: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().default(""),
  highlights: z.array(z.string()).default([]),
});

const skillGroupSchema = z.object({
  category: z.string(),
  items: z.array(z.string()).default([]),
});

const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string().default(""),
  date: z.string().default(""),
  url: z.string().default(""),
});

const contactSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  portfolio: z.string().default(""),
});

export const resumeProfileSchema = z.object({
  contact: contactSchema,
  summary: z.string().default(""),
  experiences: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export type ParsedResumeProfile = z.infer<typeof resumeProfileSchema>;

const SYSTEM_PROMPT = `You extract structured resume data from raw text.

Rules:
- Preserve the user's wording in bullets verbatim where possible — do not paraphrase.
- For each work bullet, infer up to 4 relevant skill/keyword tags (lowercase, hyphenated multi-word like "system-design").
- Dates: use the format printed in the resume; leave blank if absent.
- If a section is missing, return an empty array for it.
- Group skills by category as printed (e.g. "Languages", "Frameworks"); if uncategorized, use category "General".
- Never invent experience, projects, or credentials. If unclear, leave blank.`;

/** Single-call parse cap. Longer documents go through the chunker. */
const SINGLE_CALL_CAP = 16_000;
/** Per-chunk size for long documents (chars), with small overlap between chunks. */
const CHUNK_SIZE = 12_000;
const CHUNK_OVERLAP = 800;
/** A multi-page resume should yield at least this many bullets; fewer triggers a
 *  stronger-model re-parse. */
const MIN_BULLETS_MULTIPAGE = 5;

/** @deprecated kept for back-compat; prefer extractPdfText. */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return (await extractPdfText(buffer)).text;
}

function bulletCount(p: ParsedResumeProfile): number {
  let n = 0;
  for (const e of p.experiences) n += e.bullets.length;
  for (const pr of p.projects) n += pr.bullets.length;
  return n;
}

/** Does the parse have enough to be worth saving? */
function hasUsableContent(p: ParsedResumeProfile): boolean {
  const hasContact = Boolean(p.contact.fullName || p.contact.email);
  const hasSection =
    p.experiences.length > 0 || p.projects.length > 0 || p.education.length > 0 || p.skills.length > 0;
  return hasContact || hasSection;
}

/** Validate a finished parse before it's allowed to seed the master profile. */
export function assertParsedProfileComplete(p: ParsedResumeProfile): void {
  if (!hasUsableContent(p)) {
    throw new Error("Couldn't read any resume content from this PDF. Try re-exporting it as a text-based PDF.");
  }
}

/* -------------------- deterministic chunk merge -------------------- */

const norm = (s: string) => s.trim().toLowerCase();

function mergeBullets(a: ParsedResumeProfile["experiences"][number]["bullets"], b: typeof a) {
  const seen = new Set(a.map((x) => norm(x.text)));
  const out = [...a];
  for (const bul of b) {
    if (!seen.has(norm(bul.text))) {
      seen.add(norm(bul.text));
      out.push(bul);
    }
  }
  return out;
}

/** Merge two chunk-parses without dropping content. Entries are keyed loosely so
 *  the same job split across two chunks coalesces instead of duplicating. */
function mergeTwo(a: ParsedResumeProfile, b: ParsedResumeProfile): ParsedResumeProfile {
  const out: ParsedResumeProfile = JSON.parse(JSON.stringify(a));

  // Contact: fill empties from b.
  for (const k of Object.keys(out.contact) as (keyof typeof out.contact)[]) {
    if (!out.contact[k] && b.contact[k]) out.contact[k] = b.contact[k];
  }
  if (!out.summary && b.summary) out.summary = b.summary;

  // Experiences keyed by company|role.
  for (const exp of b.experiences) {
    const key = `${norm(exp.company)}|${norm(exp.role)}`;
    const match = out.experiences.find((e) => `${norm(e.company)}|${norm(e.role)}` === key);
    if (match) match.bullets = mergeBullets(match.bullets, exp.bullets);
    else out.experiences.push(exp);
  }
  // Projects keyed by name.
  for (const pr of b.projects) {
    const match = out.projects.find((p) => norm(p.name) === norm(pr.name));
    if (match) match.bullets = mergeBullets(match.bullets, pr.bullets);
    else out.projects.push(pr);
  }
  // Education keyed by school.
  for (const ed of b.education) {
    if (!out.education.some((e) => norm(e.school) === norm(ed.school))) out.education.push(ed);
  }
  // Skills: union items within matching categories.
  for (const grp of b.skills) {
    const match = out.skills.find((g) => norm(g.category) === norm(grp.category));
    if (match) {
      const seen = new Set(match.items.map(norm));
      for (const it of grp.items) if (!seen.has(norm(it))) match.items.push(it);
    } else out.skills.push(grp);
  }
  // Certifications keyed by name|issuer.
  for (const c of b.certifications) {
    const key = `${norm(c.name)}|${norm(c.issuer)}`;
    if (!out.certifications.some((x) => `${norm(x.name)}|${norm(x.issuer)}` === key)) out.certifications.push(c);
  }
  return out;
}

/** Split long text into overlapping chunks on paragraph boundaries. */
function chunkText(text: string): string[] {
  if (text.length <= SINGLE_CALL_CAP) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_SIZE);
    if (end < text.length) {
      // Prefer to break on a blank line near the chunk boundary.
      const para = text.lastIndexOf("\n\n", end);
      if (para > start + CHUNK_SIZE / 2) end = para;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

/* -------------------- main entrypoint -------------------- */

async function parseOnce(
  userId: string | mongoose.Types.ObjectId,
  text: string,
  capability: "fast" | "smart",
): Promise<{ profile: ParsedResumeProfile; provider: string; modelId: string }> {
  const { object, provider, modelId } = await runGenerateObject({
    userId,
    capability,
    opType: "resume_parse",
    schema: resumeProfileSchema,
    system: SYSTEM_PROMPT,
    prompt: `Extract the structured profile from this resume:\n\n${text}`,
    cacheInput: text,
  });
  return { profile: object, provider, modelId };
}

export async function parseResumePdf(
  buffer: Buffer,
  userId: string | mongoose.Types.ObjectId,
): Promise<{ profile: ParsedResumeProfile; provider: string; modelId: string }> {
  const { text, pages, scanned } = await extractPdfText(buffer);
  if (!text.trim() || scanned) {
    throw new Error(
      "This PDF looks scanned/image-only — no selectable text. Re-export it from your editor as a text-based PDF (not a scan/photo) and upload again.",
    );
  }

  // 1. First pass — chunk long documents, single call otherwise.
  const chunks = chunkText(text);
  let provider = "";
  let modelId = "";
  let profile: ParsedResumeProfile | null = null;
  for (const chunk of chunks) {
    const r = await parseOnce(userId, chunk, "fast");
    provider = r.provider;
    modelId = r.modelId;
    profile = profile ? mergeTwo(profile, r.profile) : r.profile;
  }
  if (!profile) throw new Error("Failed to parse resume.");

  // 2. Sparse/incomplete guard → re-parse the whole doc with the stronger model.
  const tooSparseForPages = pages >= 2 && bulletCount(profile) < MIN_BULLETS_MULTIPAGE;
  if (!hasUsableContent(profile) || tooSparseForPages) {
    try {
      const strong = await parseOnce(userId, text.slice(0, SINGLE_CALL_CAP * 2), "smart");
      // Keep whichever is richer (more bullets), so a worse re-parse never loses content.
      if (bulletCount(strong.profile) >= bulletCount(profile)) {
        profile = strong.profile;
        provider = strong.provider;
        modelId = strong.modelId;
      }
    } catch (err) {
      // The first pass stands; only fail outright if it had nothing usable.
      console.warn("[resumeParser] strong re-parse failed:", err instanceof Error ? err.message : err);
    }
  }

  assertParsedProfileComplete(profile);
  return { profile, provider, modelId };
}
