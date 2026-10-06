/**
 * posting.read — when a job is tracked, read the posting for its fields and
 * trim the page around it.
 *
 * Cut, not copy: the captured text is sent with numbered lines and the model
 * answers with the line RANGES that are the posting. The cleaned description
 * is rebuilt from the original lines, so it can't be paraphrased, shortened
 * into a summary, or invented — and the answer is a few dozen tokens instead
 * of re-typing the whole posting.
 *
 * Null over a guess: every field must be traceable to the captured text (or,
 * for the company, the URL). A field the model can't ground is dropped.
 */
import crypto from "crypto";
import { z } from "zod";
import mongoose from "mongoose";

import { Application, type IApplication } from "../../../models/Application.js";
import { User } from "../../../models/User.js";
import { companyFromJobUrl } from "../../jdExtractor.js";
import { runAiObject, type AiUser } from "../gateway.js";
import { laneFor } from "../routing.js";
import { registerJobHandler, startAiJob, type JobContext } from "../jobs.js";
import { DATA_RULE, fence, grounded, keepRanges, numberLines } from "./prompt.js";
import { startFitCheckForApplication } from "./fitCheck.js";

export const POSTING_READ = "posting.read";

/** Below this the posting is too thin to be worth a call. */
const MIN_JD_FOR_AI = 200;
/** A cut shorter than this is treated as a bad cut; the original stays. */
const MIN_CLEANED_JD = 120;
const MAX_INPUT_CHARS = 16_000;

const field = (what: string) =>
  z.string().nullable().describe(`${what} Copy it as written. null when the page doesn't clearly state it — never guess.`);

export const postingSchema = z.object({
  isJobPosting: z
    .boolean()
    .describe("true only if the page is (or clearly contains) ONE job posting. Search results, login walls, error pages and company pages are false."),
  company: field("The hiring company (not the job board or a recruiting agency)."),
  title: field("The job title."),
  location: field("Location, e.g. 'San Francisco, CA · Hybrid' or 'Remote (US)'."),
  salary: field("Pay exactly as written, e.g. '$120k–$150k / year'."),
  employmentType: z
    .enum(["Full-time", "Part-time", "Contract", "Internship", "Co-op", "Temporary", "Freelance"])
    .nullable()
    .describe("null unless the page says it."),
  keep: z
    .array(z.object({ from: z.number().int(), to: z.number().int() }))
    .max(12)
    .describe("Line ranges (inclusive, by the numbers shown) that ARE the posting: overview, responsibilities, requirements, qualifications, pay and benefits. Leave out navigation, cookie banners, 'similar jobs', sign-up prompts and footers. Empty when isJobPosting is false."),
});
export type PostingRead = z.infer<typeof postingSchema>;

const SYSTEM = `You read a job posting captured from a web page. The capture may be clean, or a dump of the whole page with navigation, cookie banners, "related jobs" and footers mixed in.

Each line of the capture is numbered "N| ". Answer with:
1. isJobPosting — is this one job posting?
2. The posting's fields, copied as written. Use null for anything the page doesn't clearly state. Never infer a salary, a location or an employment type.
3. keep — the line ranges that make up the posting itself. You are cutting the page down, not rewriting it.

Hints from the user or the browser extension may be supplied. They can be wrong; trust the page, but use a hint to choose between two candidates.

${DATA_RULE}`;

const PLACEHOLDERS = new Set(["", "unknown", "unknown company", "untitled role", "n/a", "none"]);
const isBlankish = (v: string | undefined | null) => PLACEHOLDERS.has((v ?? "").trim().toLowerCase());
const clip = (s: string, n: number) => s.trim().slice(0, n);

function buildPrompt(app: Pick<IApplication, "jobUrl" | "company" | "role" | "jobDescription">) {
  const { numbered, lines } = numberLines(app.jobDescription || "", MAX_INPUT_CHARS);
  const hints = [
    app.jobUrl ? `URL: ${app.jobUrl}` : "",
    !isBlankish(app.company) ? `Company hint (may be wrong): ${app.company}` : "",
    !isBlankish(app.role) ? `Title hint (may be wrong): ${app.role}` : "",
  ].filter(Boolean);
  return { prompt: [...hints, "", fence("page", numbered)].join("\n"), lines };
}

/** Apply a read to the application: grounded fields only, and the cut JD for
 *  extension captures (a pasted JD is the user's own text — never replaced). */
async function applyRead(app: IApplication, read: PostingRead, lines: string[]): Promise<void> {
  const source = `${app.jobDescription}\n${app.jobUrl ?? ""}`;
  const patch: Record<string, string> = {};
  if (read.isJobPosting) {
    // Extension scrapes are often the page <title> or "Unknown": a grounded AI
    // value replaces them. Manual entries only get their blanks filled.
    const fromExtension = app.source === "extension";
    const canFill = (current: string | undefined) => fromExtension || isBlankish(current);
    const take = (value: string | null, current: string | undefined, key: string) => {
      if (value && canFill(current) && grounded(value, source)) patch[key] = clip(value, 200);
    };
    take(read.company, app.company, "company");
    take(read.title, app.role, "role");
    take(read.location, app.location, "location");
    take(read.salary, app.salary, "salary");
    take(read.employmentType, app.jobType, "jobType");
    if (fromExtension && read.keep.length) {
      const cut = keepRanges(lines, read.keep);
      if (cut.length >= MIN_CLEANED_JD) patch.jobDescription = cut.slice(0, 50_000);
    }
  }
  await Application.updateOne({ _id: app._id }, { $set: { ...patch, aiExtractionStatus: "done" } });
  Object.assign(app, patch);
}

/** The URL-slug company when it is still blank after everything else. */
async function companyFallback(app: IApplication): Promise<void> {
  if (!isBlankish(app.company)) return;
  const slug = companyFromJobUrl(app.jobUrl);
  if (!slug) return;
  app.company = clip(slug, 200);
  await Application.updateOne({ _id: app._id }, { $set: { company: app.company } });
}

const jdHash = (jd: string | undefined) => crypto.createHash("sha1").update(jd || "").digest("hex");

/** After the read settles either way: fill the company, then the fit check. */
async function afterRead(appId: mongoose.Types.ObjectId): Promise<void> {
  const app = await Application.findById(appId);
  if (!app) return;
  await companyFallback(app);
  await startFitCheckForApplication(app, { trigger: "auto" });
}

registerJobHandler(POSTING_READ, {
  feature: POSTING_READ,
  async run(ctx: JobContext) {
    const app = await Application.findById(ctx.job.refId);
    if (!app) return { done: true };
    await ctx.progress("Reading the posting");
    const { prompt, lines } = buildPrompt(app);
    const { data } = await runAiObject(ctx.user, POSTING_READ, {
      system: SYSTEM,
      prompt,
      schema: postingSchema,
      jobId: ctx.job._id,
      budgetMs: ctx.remainingMs(),
    });
    await applyRead(app, data, lines);
    await afterRead(app._id);
    return { done: true, result: { isJobPosting: data.isJobPosting } };
  },
  async onFail(job, failure) {
    if (!job.refId) return;
    await Application.updateOne(
      { _id: job.refId },
      { $set: { aiExtractionStatus: failure.code === "off" || failure.code === "aborted" ? "idle" : "failed" } },
    );
    await afterRead(job.refId);
  },
  async onWaitingAssistant(job) {
    if (!job.refId) return;
    // The posting stays as captured until the assistant gets to it; the rest
    // of the pipeline doesn't wait.
    await Application.updateOne({ _id: job.refId }, { $set: { aiExtractionStatus: "idle" } });
    await afterRead(job.refId);
  },
  assistant: {
    async brief(job) {
      const app = await Application.findById(job.refId).lean();
      if (!app) return { instructions: "This application was deleted. Submit { isJobPosting: false, keep: [] } with nulls.", context: {} };
      const { prompt } = buildPrompt(app as unknown as IApplication);
      return {
        instructions: SYSTEM,
        context: { application: { id: String(app._id), company: app.company, role: app.role, url: app.jobUrl }, capture: prompt },
      };
    },
    schema: postingSchema,
    async apply(job, answer) {
      const app = await Application.findById(job.refId);
      if (!app) return {};
      const { lines } = buildPrompt(app);
      const read = answer as PostingRead;
      // The line numbers refer to the posting as it was when the task was
      // queued; if it was edited since, keep the fields but not the cut.
      const unchanged = job.input?.jdHash === jdHash(app.jobDescription);
      await applyRead(app, unchanged ? read : { ...read, keep: [] }, lines);
      await companyFallback(app);
      return { isJobPosting: (answer as PostingRead).isJobPosting };
    },
  },
});

/**
 * Entry point after an application is created. The create route has already
 * set `aiExtractionStatus: "processing"` when this will run.
 */
export async function enrichNewApplication(app: IApplication, opts: { isDemoUser: boolean }): Promise<void> {
  try {
    if (opts.isDemoUser) return;
    const jd = (app.jobDescription || "").trim();
    if (app.source !== "email" && jd.length >= MIN_JD_FOR_AI) {
      const owner = await User.findById(app.userId).select("email aiOverride").lean();
      const lane = owner ? await laneFor(owner as AiUser, POSTING_READ) : null;
      if (!lane || lane.refusal || lane.lane === "off") {
        await Application.updateOne({ _id: app._id }, { $set: { aiExtractionStatus: "idle" } });
        await afterRead(app._id);
        return;
      }
      await startAiJob({
        userId: app.userId,
        kind: POSTING_READ,
        refType: "application",
        refId: app._id,
        input: { jdHash: jdHash(app.jobDescription) },
        progressLabel: "Reading the posting",
      });
      return;
    }
    await afterRead(app._id);
  } catch (err) {
    console.warn("[posting.read] could not start:", err instanceof Error ? err.message : err);
    await Application.updateOne({ _id: app._id }, { $set: { aiExtractionStatus: "failed" } }).catch(() => undefined);
  }
}

export function willReadPosting(body: { source?: string; jobDescription?: string }, isDemoUser: boolean): boolean {
  return !isDemoUser && body.source !== "email" && (body.jobDescription || "").trim().length >= MIN_JD_FOR_AI;
}
