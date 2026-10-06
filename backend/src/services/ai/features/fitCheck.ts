/**
 * fit.check — read a posting against the master profile.
 *
 * The AI does what only a model can: name the role's real requirements (the
 * posting's noise stripped), say in words where the candidate is strong and
 * where they fall short, and what to change. The NUMBER is not the model's:
 * the one 0–10 match score is computed deterministically from those
 * requirements against the profile (services/resume/score.ts), and so are the
 * matched / missing keyword lists — the same profile and posting always give
 * the same score, and the score can't be talked up.
 *
 * Strengths must cite the profile; anything the model can't ground is dropped.
 */
import { z } from "zod";
import mongoose from "mongoose";

import { TailorSession, type ITailorSession } from "../../../models/TailorSession.js";
import { Application, type IApplication } from "../../../models/Application.js";
import { MasterProfile, type IMasterProfile } from "../../../models/MasterProfile.js";
import { User } from "../../../models/User.js";
import { buildResumeDocument } from "../../resume/document.js";
import { computeScore } from "../../resume/score.js";
import { extractDocText, keywordCoverage, normalizeKeyword } from "../../resume/keywords.js";
import { runAiObject, type AiUser } from "../gateway.js";
import { registerJobHandler, startAiJob, cancelJobsFor, UserFacingError, type JobContext } from "../jobs.js";
import { laneFor } from "../routing.js";
import { AiError } from "../errors.js";
import { DATA_RULE, fence, grounded } from "./prompt.js";
import { profileHasContent, profileText } from "./profileText.js";

export const FIT_CHECK = "fit.check";

const MAX_JD_CHARS = 14_000;
/** Automatic runs per user per day before new ones wait for a click. */
const AUTO_DAILY_CAP = 50;
const DAY_MS = 86_400_000;

const SECTIONS = ["summary", "experience", "projects", "skills", "education"] as const;

export const fitSchema = z.object({
  read: z
    .string()
    .describe("2–3 sentences, plain words, on THIS candidate for THIS role: the strongest overlap, the biggest gap, what to lead with. Don't restate the candidate's own summary."),
  requirements: z
    .array(z.string())
    .max(24)
    .describe("8–20 short lowercase keywords for what the role actually requires: skills, tools, methods, domain terms. Skip posting noise (applicant counts, perks, EEO text, mission statements, location tags)."),
  strengths: z
    .array(z.object({
      point: z.string().describe("A requirement the candidate meets, ≤ 14 words."),
      evidence: z.string().describe("Where the profile shows it — quote the bullet, project or skill."),
    }))
    .max(5),
  gaps: z
    .array(z.object({
      point: z.string().describe("Something the role wants that the profile doesn't show, ≤ 14 words."),
      severity: z.enum(["major", "minor"]),
    }))
    .max(5),
  changes: z
    .array(z.object({
      section: z.enum(SECTIONS),
      target: z.string().describe("The company or project it applies to, or '' for the whole section."),
      change: z.string().describe("What to change, ≤ 25 words. Advice, not a rewritten bullet."),
      why: z.string().describe("Which requirement it serves, ≤ 15 words."),
    }))
    .max(6)
    .describe("Most impactful first. Only changes the candidate's real experience supports."),
  sectionFlags: z
    .array(z.object({
      section: z.enum(SECTIONS),
      severity: z.enum(["good", "warn", "gap"]),
      note: z.string().describe("≤ 18 words, specific to this role."),
    }))
    .max(5)
    .describe("One per section the candidate has: good = serves the role, warn = underplays it, gap = missing what the role wants."),
});
export type FitRead = z.infer<typeof fitSchema>;

const SYSTEM = `You compare a job posting with a candidate's career profile, for the candidate.

Be honest and specific. Name their real companies, projects and bullets. Never claim the candidate has experience the profile doesn't show, and don't inflate a weak match — a clear "not yet" is more useful than flattery. Every strength must cite the profile.

The requirements list is about the JOB, not the candidate: what the role asks for, whether or not the candidate has it.

${DATA_RULE}`;

export interface FitInput {
  jobTitle?: string;
  company?: string;
  url?: string;
  jobDescription: string;
}

function buildPrompt(jd: FitInput, profile: IMasterProfile): string {
  const meta = [
    jd.company ? `Company: ${jd.company}` : "",
    jd.jobTitle ? `Title: ${jd.jobTitle}` : "",
    jd.url ? `URL: ${jd.url}` : "",
  ].filter(Boolean);
  return [...meta, "", fence("posting", jd.jobDescription.slice(0, MAX_JD_CHARS)), "", fence("profile", profileText(profile))].join("\n");
}

export interface FitResult {
  matchScore: number;
  summary: string;
  jdKeywords: string[];
  matchedSkills: string[];
  missingSkills: string[];
  strengths: FitRead["strengths"];
  gaps: FitRead["gaps"];
  changes: FitRead["changes"];
  sectionFlags: FitRead["sectionFlags"];
}

/** The deterministic half: score + keyword lists from the AI's requirements. */
export function settleFit(read: FitRead, profile: IMasterProfile): FitResult {
  const seen = new Set<string>();
  const jdKeywords: string[] = [];
  for (const raw of read.requirements) {
    const k = normalizeKeyword(raw);
    if (k && !seen.has(k)) {
      seen.add(k);
      jdKeywords.push(k);
    }
  }
  const doc = buildResumeDocument(profile);
  const docText = extractDocText(doc);
  const gap = keywordCoverage(jdKeywords, docText);
  const pText = profileText(profile);
  return {
    matchScore: computeScore(doc, jdKeywords),
    summary: read.read.trim(),
    jdKeywords,
    matchedSkills: gap.matched,
    missingSkills: gap.missing,
    // A strength the profile can't back up is a guess — drop it.
    strengths: read.strengths.filter((s) => grounded(s.evidence, pText)),
    gaps: read.gaps,
    changes: read.changes,
    sectionFlags: read.sectionFlags,
  };
}

/** Run a fit check now (the caller waits) — Studio's "See the gap". */
export async function runFitCheck(
  user: AiUser,
  jd: FitInput,
  opts: { jobId?: mongoose.Types.ObjectId; budgetMs?: number } = {},
): Promise<FitResult & { provider: string; model: string }> {
  const profile = await MasterProfile.findOne({ userId: user._id });
  if (!profile || !profileHasContent(profile)) {
    throw new UserFacingError("Set up your profile first — upload a resume on the Profile page.");
  }
  const { data, provider, model } = await runAiObject(user, FIT_CHECK, {
    system: SYSTEM,
    prompt: buildPrompt(jd, profile),
    schema: fitSchema,
    jobId: opts.jobId,
    budgetMs: opts.budgetMs,
  });
  return { ...settleFit(data, profile), provider, model };
}

async function writeSession(sessionId: mongoose.Types.ObjectId, fit: FitResult, by: { provider: string; model: string }) {
  await TailorSession.updateOne(
    { _id: sessionId },
    {
      $set: {
        status: "succeeded",
        errorMessage: "",
        errorCode: "",
        errorLane: "",
        matchScore: fit.matchScore,
        summary: fit.summary,
        jdKeywords: fit.jdKeywords,
        matchedSkills: fit.matchedSkills,
        missingSkills: fit.missingSkills,
        strengths: fit.strengths,
        gaps: fit.gaps,
        changes: fit.changes,
        sectionFlags: fit.sectionFlags,
        suggestions: [],
        fitScore: 0,
        fitGrade: "",
        provider: by.provider,
        modelId: by.model,
      },
    },
  );
}

registerJobHandler(FIT_CHECK, {
  feature: FIT_CHECK,
  async run(ctx: JobContext) {
    const session = await TailorSession.findById(ctx.job.refId);
    if (!session) return { done: true };
    await ctx.progress("Checking your fit");
    const fit = await runFitCheck(
      ctx.user,
      { jobTitle: session.jobTitle, company: session.company, url: session.jobUrl, jobDescription: session.jobDescription },
      { jobId: ctx.job._id, budgetMs: ctx.remainingMs() },
    );
    await writeSession(session._id, fit, fit);
    return { done: true, result: { matchScore: fit.matchScore } };
  },
  async onFail(job, failure) {
    if (!job.refId) return;
    await TailorSession.updateOne(
      { _id: job.refId },
      {
        $set: {
          status: "failed",
          errorMessage: failure.code === "aborted" ? "Stopped." : failure.message,
          errorCode: failure.code === "internal" ? "" : `ai_${failure.code}`,
          errorLane: failure.lane ?? "",
        },
      },
    );
  },
  async onWaitingAssistant(job) {
    if (!job.refId) return;
    await TailorSession.updateOne(
      { _id: job.refId },
      { $set: { status: "waiting_assistant", errorMessage: "Waiting for your assistant — ask it to do your HireTrail AI tasks." } },
    );
  },
  assistant: {
    async brief(job) {
      const session = await TailorSession.findById(job.refId).lean();
      const profile = session ? await MasterProfile.findOne({ userId: session.userId }) : null;
      if (!session || !profile) return { instructions: "This fit check's application or profile is gone. Submit an empty read.", context: {} };
      return {
        instructions: SYSTEM,
        context: {
          job: { title: session.jobTitle, company: session.company, url: session.jobUrl },
          input: buildPrompt(
            { jobTitle: session.jobTitle, company: session.company, url: session.jobUrl, jobDescription: session.jobDescription },
            profile,
          ),
        },
      };
    },
    schema: fitSchema,
    async apply(job, answer) {
      const session = await TailorSession.findById(job.refId);
      const profile = session ? await MasterProfile.findOne({ userId: session.userId }) : null;
      if (!session || !profile) return {};
      const fit = settleFit(answer as FitRead, profile);
      await writeSession(session._id, fit, { provider: "assistant", model: "" });
      return { matchScore: fit.matchScore };
    },
  },
});

/* ---------------- starting a fit check ---------------- */

interface SessionSeed {
  userId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId | null;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobDescription: string;
}

/** Create a processing session and queue its job. */
export async function queueFitCheck(seed: SessionSeed): Promise<ITailorSession> {
  const session = await TailorSession.create({
    ...seed,
    jobDescription: seed.jobDescription.slice(0, 30_000),
    status: "processing",
    fitScore: 0,
    fitGrade: "",
    provider: "",
    modelId: "",
  });
  await startAiJob({
    userId: seed.userId,
    kind: FIT_CHECK,
    refType: "tailorSession",
    refId: session._id,
    progressLabel: "Checking your fit",
  });
  return session;
}

/**
 * Fit check for a tracked application.
 *   auto   — on track: quietly skipped when it can't or shouldn't run (no
 *            profile, too short, the feature is off, the daily auto cap).
 *   manual — the person asked: problems are thrown as plain sentences.
 */
export async function startFitCheckForApplication(
  app: Pick<IApplication, "_id" | "userId" | "jobDescription" | "role" | "company" | "jobUrl" | "tailorSessionId" | "source">,
  opts: { trigger: "auto" | "manual"; user?: AiUser },
): Promise<ITailorSession | null> {
  const auto = opts.trigger === "auto";
  const jd = (app.jobDescription || "").trim();
  if (auto && (app.source === "email" || app.tailorSessionId || jd.length < 200)) return null;
  if (!auto && jd.length < 50) throw new UserFacingError("Add a job description before running a fit check.");

  const profile = await MasterProfile.findOne({ userId: app.userId }).select("summary experiences projects skills education").lean();
  if (!profileHasContent(profile as IMasterProfile | null)) {
    if (auto) return null;
    throw new UserFacingError("Set up your profile first — upload a resume on the Profile page.");
  }

  if (auto) {
    const full = await User.findById(app.userId).select("email aiOverride").lean();
    if (!full) return null;
    const lane = await laneFor(full as AiUser, FIT_CHECK);
    if (lane.refusal || lane.lane === "off") return null;
  } else if (opts.user) {
    const lane = await laneFor(opts.user, FIT_CHECK);
    if (lane.refusal) throw new AiError(lane.refusal.code, { feature: FIT_CHECK, featureLabel: "Fit check", custom: lane.refusal.custom });
    if (lane.lane === "off") throw new AiError("off", { lane: "off", feature: FIT_CHECK, featureLabel: "Fit check" });
  }

  const seed: SessionSeed = {
    userId: app.userId,
    applicationId: app._id,
    jobTitle: app.role || "",
    company: app.company || "",
    jobUrl: app.jobUrl || "",
    jobDescription: jd,
  };

  if (auto) {
    const usedToday = await TailorSession.countDocuments({ userId: app.userId, createdAt: { $gte: new Date(Date.now() - DAY_MS) } });
    if (usedToday >= AUTO_DAILY_CAP) {
      const deferred = await TailorSession.create({
        ...seed,
        jobDescription: jd.slice(0, 30_000),
        status: "deferred",
        errorMessage: "Lots of jobs tracked today — run this fit check when you're ready.",
      });
      await Application.updateOne({ _id: app._id }, { $set: { tailorSessionId: deferred._id } });
      return deferred;
    }
  } else if (app.tailorSessionId) {
    await cancelJobsFor("tailorSession", app.tailorSessionId, FIT_CHECK);
  }

  const session = await queueFitCheck(seed);
  await Application.updateOne({ _id: app._id }, { $set: { tailorSessionId: session._id } });
  return session;
}
