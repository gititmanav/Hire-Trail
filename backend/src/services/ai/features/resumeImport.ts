/**
 * resume.import (+ profile.merge) — a resume PDF becomes the master profile.
 *
 *   in the request  — the PDF's text is extracted (fast, no AI). A scanned PDF
 *                     or a refused lane is answered right there, in words,
 *                     instead of flipping the profile into "processing" first.
 *   job steps       — the text is parsed chunk by chunk; each step stops well
 *                     inside its time budget and the job continues itself, so
 *                     a long CV is several short steps, never one timeout. A
 *                     multi-page resume that parses suspiciously thin is read
 *                     once more on the provider's stronger model.
 *   merge           — into an existing profile: by AI (profile.merge) when it
 *                     is on and the result keeps everything; otherwise by
 *                     deterministic rules that never drop anything. The
 *                     profile as it was is kept in one slot for "Undo import".
 */
import { z } from "zod";
import mongoose from "mongoose";

import { MasterProfile, type IMasterProfile } from "../../../models/MasterProfile.js";
import { User } from "../../../models/User.js";
import { extractPdfText } from "../pdfText.js";
import { runAiObject, type AiUser } from "../gateway.js";
import { registerJobHandler, startAiJob, cancelJobsFor, UserFacingError, type JobContext } from "../jobs.js";
import { laneFor } from "../routing.js";
import { AiError, isAiError } from "../errors.js";
import { DATA_RULE, fence } from "./prompt.js";
import { profileHasContent } from "./profileText.js";

export const RESUME_IMPORT = "resume.import";
export const PROFILE_MERGE = "profile.merge";

/* ---------------- the profile shape ---------------- */

const bulletSchema = z.object({ text: z.string(), tags: z.array(z.string()).default([]) });

export const resumeProfileSchema = z.object({
  contact: z.object({
    fullName: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    location: z.string().default(""),
    linkedin: z.string().default(""),
    github: z.string().default(""),
    portfolio: z.string().default(""),
  }),
  summary: z.string().default(""),
  experiences: z.array(z.object({
    company: z.string(),
    role: z.string(),
    location: z.string().default(""),
    startDate: z.string().default(""),
    endDate: z.string().default(""),
    current: z.boolean().default(false),
    bullets: z.array(bulletSchema).default([]),
  })).default([]),
  projects: z.array(z.object({
    name: z.string(),
    url: z.string().default(""),
    description: z.string().default(""),
    bullets: z.array(bulletSchema).default([]),
    technologies: z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string().default(""),
    field: z.string().default(""),
    location: z.string().default(""),
    startDate: z.string().default(""),
    endDate: z.string().default(""),
    gpa: z.string().default(""),
    highlights: z.array(z.string()).default([]),
  })).default([]),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()).default([]) })).default([]),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string().default(""),
    date: z.string().default(""),
    url: z.string().default(""),
  })).default([]),
});
export type ParsedProfile = z.infer<typeof resumeProfileSchema>;

const PARSE_SYSTEM = `You turn the text of a resume into structured data.

- Copy bullets in the candidate's own words. Don't paraphrase, polish or summarise.
- Tag each bullet with up to 4 lowercase skill keywords ("system-design", "kafka").
- Dates as printed; blank when absent.
- Group skills by the resume's own categories; uncategorised skills go under "General".
- An absent section is an empty list. Never invent a job, project, school, date or credential.
- The text may be one part of a longer resume: extract what is in this part only.

${DATA_RULE}`;

const MERGE_SYSTEM = `You merge two structured resume profiles into one career history. The MASTER is the source of truth.

- Never drop anything the master has: every experience, project, school, skill and certification survives.
- The same job (same company and role) or project appears once: keep every distinct bullet, drop near-duplicates (keep the more specific or quantified wording), union the tags.
- Skills: union, de-duplicated case-insensitively, in the master's categories; new ones go to a fitting category or "General".
- Contact fields and the summary: keep the master's; fill from the incoming only where the master is blank.
- Don't invent anything.

${DATA_RULE}`;

/* ---------------- deterministic helpers ---------------- */

const SINGLE_CALL_CAP = 16_000;
const CHUNK_SIZE = 12_000;
const CHUNK_OVERLAP = 800;
const MIN_BULLETS_MULTIPAGE = 5;
/** Don't start another AI call in a step with less time than this left. */
const CALL_HEADROOM_MS = 70_000;

function chunkText(text: string): string[] {
  if (text.length <= SINGLE_CALL_CAP) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_SIZE);
    if (end < text.length) {
      const para = text.lastIndexOf("\n\n", end);
      if (para > start + CHUNK_SIZE / 2) end = para;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

const bulletCount = (p: ParsedProfile) =>
  p.experiences.reduce((n, e) => n + e.bullets.length, 0) + p.projects.reduce((n, pr) => n + pr.bullets.length, 0);

const usable = (p: ParsedProfile) =>
  Boolean(p.contact.fullName || p.contact.email) || p.experiences.length + p.projects.length + p.education.length + p.skills.length > 0;

const key = (s: string) => s.trim().toLowerCase();

function unionBullets<T extends { text: string; tags?: string[] }>(a: T[], b: T[]): T[] {
  const seen = new Set(a.map((x) => key(x.text)));
  const out = [...a];
  for (const x of b) if (!seen.has(key(x.text))) { seen.add(key(x.text)); out.push(x); }
  return out;
}

/** Merge `b` into `a` by rules: nothing is dropped; the same job, project,
 *  school, skill group or certification coalesces. `a` wins on scalar fields. */
export function mergeByRules(a: ParsedProfile, b: ParsedProfile): ParsedProfile {
  const out: ParsedProfile = JSON.parse(JSON.stringify(a));
  for (const k of Object.keys(out.contact) as (keyof ParsedProfile["contact"])[]) {
    if (!out.contact[k] && b.contact[k]) out.contact[k] = b.contact[k];
  }
  if (!out.summary && b.summary) out.summary = b.summary;
  for (const exp of b.experiences) {
    const m = out.experiences.find((e) => key(e.company) === key(exp.company) && key(e.role) === key(exp.role));
    if (m) m.bullets = unionBullets(m.bullets, exp.bullets);
    else out.experiences.push(exp);
  }
  for (const pr of b.projects) {
    const m = out.projects.find((p) => key(p.name) === key(pr.name));
    if (m) {
      m.bullets = unionBullets(m.bullets, pr.bullets);
      m.technologies = [...new Set([...m.technologies, ...pr.technologies])];
    } else out.projects.push(pr);
  }
  for (const ed of b.education) {
    const m = out.education.find((e) => key(e.school) === key(ed.school));
    if (m) m.highlights = [...new Set([...m.highlights, ...ed.highlights])];
    else out.education.push(ed);
  }
  for (const g of b.skills) {
    const m = out.skills.find((x) => key(x.category) === key(g.category));
    if (m) {
      const seen = new Set(m.items.map(key));
      for (const it of g.items) if (!seen.has(key(it))) { seen.add(key(it)); m.items.push(it); }
    } else out.skills.push(g);
  }
  for (const c of b.certifications) {
    if (!out.certifications.some((x) => key(x.name) === key(c.name) && key(x.issuer) === key(c.issuer))) out.certifications.push(c);
  }
  return out;
}

/** An AI merge is only accepted if every list is at least as long as the master's. */
function keepsEverything(master: ParsedProfile, merged: ParsedProfile): boolean {
  const lists = ["experiences", "projects", "education", "skills", "certifications"] as const;
  if (lists.some((f) => master[f].length > 0 && merged[f].length < master[f].length)) return false;
  return bulletCount(merged) >= bulletCount(master);
}

function asParsed(p: IMasterProfile | ParsedProfile): ParsedProfile {
  const plain = typeof (p as IMasterProfile).toObject === "function" ? (p as IMasterProfile).toObject() : p;
  return resumeProfileSchema.parse({
    contact: plain.contact ?? {},
    summary: plain.summary ?? "",
    experiences: plain.experiences ?? [],
    projects: plain.projects ?? [],
    education: plain.education ?? [],
    skills: plain.skills ?? [],
    certifications: plain.certifications ?? [],
  });
}

/* ---------------- the job ---------------- */

interface ImportState {
  i?: number;
  partial?: ParsedProfile | null;
  strongDone?: boolean;
  provider?: string;
  model?: string;
}

async function parseChunk(ctx: JobContext, text: string, first: boolean, tier?: "smart") {
  return runAiObject(ctx.user, RESUME_IMPORT, {
    system: PARSE_SYSTEM,
    prompt: fence("resume", text),
    schema: resumeProfileSchema,
    jobId: ctx.job._id,
    countsAsUse: first,
    budgetMs: Math.max(ctx.remainingMs() - 10_000, 5_000),
    tier,
  });
}

/** Merge (if there's a profile to merge into) and write. Returns how. */
async function writeProfile(
  user: AiUser,
  incoming: ParsedProfile,
  resumeId: string | null,
  by: string,
  opts: { allowAiMerge: boolean; jobId?: mongoose.Types.ObjectId; budgetMs?: number },
): Promise<{ method: "created" | "replaced" | "merged-ai" | "merged-rules" }> {
  const existing = await MasterProfile.findOne({ userId: user._id });
  const prefs = await User.findById(user._id).select("mergeResumesEnabled").lean();
  const mergeWanted = prefs?.mergeResumesEnabled !== false;

  let final = incoming;
  let method: "created" | "replaced" | "merged-ai" | "merged-rules" = "created";
  if (existing && profileHasContent(existing)) {
    const master = asParsed(existing);
    if (!mergeWanted) {
      method = "replaced";
    } else {
      final = mergeByRules(master, incoming);
      method = "merged-rules";
      const lane = opts.allowAiMerge ? await laneFor(user, PROFILE_MERGE) : null;
      if (lane && !lane.refusal && (lane.lane === "included" || lane.lane === "byok")) {
        try {
          const { data } = await runAiObject(user, PROFILE_MERGE, {
            system: MERGE_SYSTEM,
            prompt: [fence("profile", JSON.stringify(master)), "", "INCOMING:", fence("resume", JSON.stringify(incoming))].join("\n"),
            schema: resumeProfileSchema,
            jobId: opts.jobId,
            budgetMs: opts.budgetMs,
          });
          if (keepsEverything(master, data)) {
            final = data;
            method = "merged-ai";
          } else {
            console.warn(`[resume.import] AI merge dropped content for ${user._id}; merged by rules instead`);
          }
        } catch (err) {
          // The rules merge already stands; an AI hiccup must not lose the import.
          if (!isAiError(err)) throw err;
          console.warn(`[resume.import] AI merge failed (${err.aiCode}); merged by rules instead`);
        }
      }
    }
  }

  await MasterProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        ...final,
        ...(resumeId && mongoose.isValidObjectId(resumeId) ? { sourceResumeId: resumeId } : {}),
        lastParsedAt: new Date(),
        lastParsedProvider: `${by}${method.startsWith("merged") ? ` (${method})` : ""}`,
        parseStatus: "idle",
        parseError: "",
        parseStartedAt: null,
        lastImportSnapshot:
          existing && profileHasContent(existing)
            ? { profile: asParsed(existing), savedAt: new Date(), method: method === "replaced" ? "replaced" : "merged" }
            : null,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { method };
}

registerJobHandler(RESUME_IMPORT, {
  feature: RESUME_IMPORT,
  async run(ctx) {
    const text = String(ctx.job.input.text ?? "");
    const pages = Number(ctx.job.input.pages ?? 1);
    const state = (ctx.job.state ?? {}) as ImportState;
    const chunks = chunkText(text);
    let i = state.i ?? 0;
    let partial = state.partial ?? null;
    let provider = state.provider ?? "";
    let model = state.model ?? "";

    while (i < chunks.length) {
      if (i > 0 && ctx.remainingMs() < CALL_HEADROOM_MS) return { done: false, state: { i, partial, provider, model } };
      await ctx.progress(chunks.length > 1 ? `Reading your resume (${i + 1} of ${chunks.length})` : "Reading your resume", i, chunks.length);
      const r = await parseChunk(ctx, chunks[i], i === 0);
      partial = partial ? mergeByRules(partial, r.data) : r.data;
      provider = r.provider;
      model = r.model;
      i += 1;
    }
    if (!partial) throw new UserFacingError("Couldn't read this resume. Try exporting it as a text-based PDF.");

    // A multi-page resume that parsed thin gets one read on the stronger model.
    const thin = !usable(partial) || (pages >= 2 && bulletCount(partial) < MIN_BULLETS_MULTIPAGE);
    if (thin && !state.strongDone) {
      if (ctx.remainingMs() < CALL_HEADROOM_MS) return { done: false, state: { i, partial, provider, model } };
      await ctx.progress("Taking a closer look");
      try {
        const strong = await parseChunk(ctx, text.slice(0, SINGLE_CALL_CAP * 2), false, "smart");
        if (bulletCount(strong.data) >= bulletCount(partial)) {
          partial = strong.data;
          provider = strong.provider;
          model = strong.model;
        }
      } catch (err) {
        if (!isAiError(err)) throw err;
        console.warn(`[resume.import] closer look failed (${err.aiCode}); keeping the first read`);
      }
    }
    if (!usable(partial)) throw new UserFacingError("Couldn't find resume content in this PDF. Try exporting it as a text-based PDF.");

    if (ctx.remainingMs() < CALL_HEADROOM_MS) return { done: false, state: { i, partial, provider, model, strongDone: true } };
    await ctx.progress("Adding it to your profile");
    const { method } = await writeProfile(ctx.user, partial, String(ctx.job.input.resumeId ?? ""), `${provider}:${model}`, {
      allowAiMerge: true,
      jobId: ctx.job._id,
      budgetMs: ctx.remainingMs() - 10_000,
    });
    return { done: true, result: { method } };
  },
  async onFail(job, failure) {
    await MasterProfile.updateOne(
      { userId: job.userId },
      { $set: { parseStatus: "failed", parseError: failure.code === "aborted" ? "Stopped." : failure.message, parseStartedAt: null } },
    );
  },
  async onWaitingAssistant(job) {
    await MasterProfile.updateOne(
      { userId: job.userId },
      { $set: { parseStatus: "waiting_assistant", parseError: "", parseStartedAt: null } },
    );
  },
  assistant: {
    async brief(job) {
      return {
        instructions: `${PARSE_SYSTEM}\n\nThis is the whole resume: extract all of it.`,
        context: { resume: fence("resume", String(job.input.text ?? "").slice(0, 60_000)) },
      };
    },
    schema: resumeProfileSchema,
    async apply(job, answer) {
      const user = await User.findById(job.userId).select("email aiOverride").lean();
      if (!user) return {};
      const { method } = await writeProfile(user as AiUser, answer as ParsedProfile, String(job.input.resumeId ?? ""), "assistant", {
        allowAiMerge: false,
      });
      return { method };
    },
  },
});

/* ---------------- starting an import ---------------- */

/**
 * Read the PDF now, refuse plainly if it can't be imported, then queue the
 * parse. Throws (UserFacingError / AiError) before anything is marked
 * "processing", so a refusal never leaves a spinner behind.
 */
export async function startResumeImport(user: AiUser, resumeId: mongoose.Types.ObjectId, pdf: Buffer): Promise<void> {
  const decision = await laneFor(user, RESUME_IMPORT);
  if (decision.refusal) {
    throw new AiError(decision.refusal.code, { feature: RESUME_IMPORT, featureLabel: "Import a resume", custom: decision.refusal.custom });
  }

  let extracted: { text: string; pages: number; scanned: boolean };
  try {
    extracted = await extractPdfText(pdf);
  } catch {
    throw new UserFacingError("This file couldn't be opened as a PDF. Export it again and upload the new file.");
  }
  if (!extracted.text.trim() || extracted.scanned) {
    throw new UserFacingError("This PDF looks like a scan — there's no selectable text. Export it from your editor as a text-based PDF and upload that.");
  }

  await cancelJobsFor("masterProfile", user._id, RESUME_IMPORT);
  await MasterProfile.findOneAndUpdate(
    { userId: user._id },
    { $set: { parseStatus: "processing", parseError: "", parseStartedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  await startAiJob({
    userId: user._id,
    kind: RESUME_IMPORT,
    refType: "masterProfile",
    refId: user._id,
    input: { text: extracted.text.slice(0, 120_000), pages: extracted.pages, resumeId: resumeId.toString() },
    progressLabel: "Reading your resume",
  });
}

/** Put the profile back as it was before the last import. */
export async function undoLastImport(userId: mongoose.Types.ObjectId): Promise<boolean> {
  const profile = await MasterProfile.findOne({ userId });
  const snap = profile?.lastImportSnapshot;
  if (!profile || !snap?.profile) return false;
  const restored = resumeProfileSchema.parse(snap.profile);
  await MasterProfile.updateOne({ _id: profile._id }, { $set: { ...restored, lastImportSnapshot: null } });
  return true;
}
