/**
 * HireTrail's MCP server — one per request (stateless), bound to the person
 * behind the token.
 *
 *   read  — look things up: the pipeline, one application with its posting
 *           and fit read, deadlines, contacts, the profile, resumes
 *   write — change things through the SAME write paths as the app (add or
 *           update an application, notes, deadlines; merge into the profile
 *           by rules, with undo; propose resume rewrites the person accepts
 *           in the Studio)
 *   ai    — pick up AI work that runs in the assistant lane: list, start
 *           (get the instructions, the input and the exact answer shape),
 *           finish (the answer goes through the same checks as HireTrail's
 *           own AI)
 *
 * Every tool returns plain words on failure (`isError`) so the model can tell
 * the person what happened; nothing here throws a stack at a client.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { zodSchema } from "ai";
import { z } from "zod";
import mongoose from "mongoose";

import type { IMcpToken, McpScope } from "../../models/McpToken.js";
import type { AiPolicy } from "../ai/settings.js";
import type { AiUser } from "../ai/gateway.js";
import { Application, STAGES } from "../../models/Application.js";
import { Deadline, DEADLINE_TYPES } from "../../models/Deadline.js";
import { Contact } from "../../models/Contact.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { Resume } from "../../models/Resume.js";
import { TailorSession } from "../../models/TailorSession.js";
import { AppError } from "../../errors/AppError.js";
import { createApplication, updateApplication, DuplicateApplicationError } from "../applications/write.js";
import { loadOrBuildDocument } from "../resume/store.js";
import { escapeRegex } from "../../utils/regex.js";
import { aiFeature } from "../ai/registry.js";
import { assistantQueue, claimForAssistant, submitFromAssistant } from "../ai/jobs.js";
import { mergeByRules, resumeProfileSchema } from "../ai/features/resumeImport.js";
import { proposeFromAssistant, proposalAnswerSchema, tailoringBrief } from "../ai/features/resumeTailor.js";
import { laneFor } from "../ai/routing.js";
import { profileHasContent } from "../ai/features/profileText.js";
import { chargeRate } from "./tokens.js";

export interface McpContext {
  user: AiUser & { name?: string };
  token: IMcpToken;
  policy: AiPolicy;
}

const json = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: message }] });
const day = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "hiretrail", version: "1.0.0" },
    {
      instructions:
        "HireTrail is the person's job-search tracker: applications through stages (Drafting, Applied, OA, Interview, Offer, Rejected), deadlines, contacts, their master career profile and resumes. " +
        "Use the read tools to answer questions about their search. Writes change their real data — confirm anything non-obvious first. " +
        "When they ask you to do their HireTrail AI tasks, call list_ai_tasks, then start_ai_task and finish_ai_task for each one. " +
        "Never invent experience, employers, dates or numbers for their profile or resume.",
    },
  );
  const userId = ctx.user._id;

  /** Scope + policy + rate gate for one tool call. */
  async function gate(scope: McpScope, write = false): Promise<CallToolResult | null> {
    if (!ctx.token.scopes.includes(scope)) {
      return fail(`This connection can't ${scope === "read" ? "read" : scope === "write" ? "change" : "do AI tasks in"} HireTrail. Create a connection with that access in Settings → AI.`);
    }
    if (write && !ctx.policy.mcp.writeToolsEnabled) return fail("HireTrail has switched off changes from assistants for now. Reading still works.");
    if (write && !(await chargeRate(ctx.token._id, "write", ctx.policy.mcp))) {
      return fail(`That's the hourly limit of ${ctx.policy.mcp.writesPerHour} changes from an assistant. Try again next hour.`);
    }
    return null;
  }

  /** Run a tool body; operational errors become words for the model. */
  const run = (scope: McpScope, write: boolean, body: () => Promise<CallToolResult>) => async (): Promise<CallToolResult> => {
    const blocked = await gate(scope, write);
    if (blocked) return blocked;
    try {
      return await body();
    } catch (err) {
      if (err instanceof DuplicateApplicationError) return fail(`That job is already tracked (application ${err.applicationId}).`);
      if (err instanceof AppError) return fail(err.message);
      console.error("[mcp] tool failed:", err);
      return fail("Something went wrong on HireTrail's side. Try again in a moment.");
    }
  };

  /* ---------------- read ---------------- */

  server.registerTool("whoami", {
    title: "Who am I",
    description: "The signed-in person, a summary of their pipeline, and which AI features run in their assistant.",
    annotations: READ,
  }, run("read", false, async () => {
    const [byStage, upcoming] = await Promise.all([
      Application.aggregate<{ _id: string; n: number }>([{ $match: { userId, archived: { $ne: true } } }, { $group: { _id: "$stage", n: { $sum: 1 } } }]),
      Deadline.countDocuments({ userId, completed: false, dueDate: { $gte: new Date(Date.now() - 86_400_000) } }),
    ]);
    const lanes: Record<string, string | null> = {};
    for (const id of ["posting.read", "fit.check", "resume.import", "resume.tailor"]) {
      lanes[aiFeature(id).label] = (await laneFor(ctx.user, id)).lane;
    }
    return json({
      name: ctx.user.name ?? "",
      email: ctx.user.email,
      activeApplications: Object.fromEntries(byStage.map((s) => [s._id, s.n])),
      openDeadlines: upcoming,
      aiFeatureLanes: lanes,
      connection: { name: ctx.token.name, scopes: ctx.token.scopes },
    });
  }));

  server.registerTool("list_applications", {
    title: "List applications",
    description: "Tracked applications, newest first. Filter by stage or a search over company and role.",
    inputSchema: {
      stage: z.enum(STAGES).optional(),
      search: z.string().max(100).optional().describe("Matches company or role."),
      archived: z.boolean().optional().describe("true = only archived; default only active."),
      limit: z.number().int().min(1).max(100).optional().describe("Default 30."),
    },
    annotations: READ,
  }, async (args) => run("read", false, async () => {
    const filter: Record<string, unknown> = { userId, archived: args.archived ? true : { $ne: true } };
    if (args.stage) filter.stage = args.stage;
    if (args.search?.trim()) {
      const rx = new RegExp(escapeRegex(args.search.trim()), "i");
      filter.$or = [{ company: rx }, { role: rx }];
    }
    const apps = await Application.find(filter)
      .sort({ applicationDate: -1, _id: -1 })
      .limit(args.limit ?? 30)
      .select("company role stage applicationDate jobUrl location tailorSessionId")
      .lean();
    const sessions = await TailorSession.find({ _id: { $in: apps.map((a) => a.tailorSessionId).filter(Boolean) } }).select("matchScore status").lean();
    const score = new Map(sessions.map((s) => [String(s._id), s.status === "succeeded" ? s.matchScore : null]));
    return json(apps.map((a) => ({
      id: String(a._id),
      company: a.company,
      role: a.role,
      stage: a.stage,
      applied: day(a.applicationDate),
      location: a.location || undefined,
      url: a.jobUrl || undefined,
      matchScore: a.tailorSessionId ? score.get(String(a.tailorSessionId)) ?? null : null,
    })));
  })());

  server.registerTool("get_application", {
    title: "Get an application",
    description: "One application in full: the posting text, notes, stage history, its fit check (score, strengths, gaps, what to change) and open deadlines.",
    inputSchema: { id: z.string().describe("Application id from list_applications.") },
    annotations: READ,
  }, async ({ id }) => run("read", false, async () => {
    if (!mongoose.isValidObjectId(id)) return fail("No application with that id.");
    const a = await Application.findOne({ _id: id, userId }).lean();
    if (!a) return fail("No application with that id.");
    const [session, deadlines] = await Promise.all([
      a.tailorSessionId ? TailorSession.findById(a.tailorSessionId).lean() : null,
      Deadline.find({ userId, applicationId: a._id, completed: false }).sort({ dueDate: 1 }).lean(),
    ]);
    return json({
      id: String(a._id),
      company: a.company,
      role: a.role,
      stage: a.stage,
      applied: day(a.applicationDate),
      url: a.jobUrl || undefined,
      location: a.location || undefined,
      salary: a.salary || undefined,
      jobType: a.jobType || undefined,
      notes: a.notes || undefined,
      stageHistory: (a.stageHistory ?? []).map((h) => ({ stage: h.stage, date: day(h.date) })),
      jobDescription: (a.jobDescription || "").slice(0, 12_000) || undefined,
      fitCheck: session?.status === "succeeded"
        ? {
            matchScore: session.matchScore,
            read: session.summary,
            requirements: session.jdKeywords,
            matched: session.matchedSkills,
            missing: session.missingSkills,
            strengths: session.strengths,
            gaps: session.gaps,
            whatToChange: session.changes,
          }
        : session ? { status: session.status } : null,
      openDeadlines: deadlines.map((d) => ({ id: String(d._id), type: d.type, due: day(d.dueDate), notes: d.notes || undefined })),
    });
  })());

  server.registerTool("list_deadlines", {
    title: "List deadlines",
    description: "Open deadlines (assessments, follow-ups, interview prep, offer decisions), soonest first, with overdue ones included.",
    inputSchema: { days: z.number().int().min(1).max(120).optional().describe("How far ahead to look. Default 14.") },
    annotations: READ,
  }, async ({ days }) => run("read", false, async () => {
    const until = new Date(Date.now() + (days ?? 14) * 86_400_000);
    const rows = await Deadline.find({ userId, completed: false, dueDate: { $lte: until } }).sort({ dueDate: 1 }).limit(100).lean();
    const apps = await Application.find({ _id: { $in: rows.map((r) => r.applicationId).filter(Boolean) } }).select("company role").lean();
    const byId = new Map(apps.map((a) => [String(a._id), a]));
    return json(rows.map((d) => {
      const a = d.applicationId ? byId.get(String(d.applicationId)) : null;
      return { id: String(d._id), type: d.type, due: day(d.dueDate), overdue: d.dueDate < new Date(), application: a ? `${a.role} · ${a.company}` : undefined, notes: d.notes || undefined };
    }));
  })());

  server.registerTool("list_contacts", {
    title: "List contacts",
    description: "Networking contacts — recruiters, referrals, people at companies — with outreach status.",
    inputSchema: {
      search: z.string().max(100).optional().describe("Matches name, company or role."),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: READ,
  }, async ({ search, limit }) => run("read", false, async () => {
    const filter: Record<string, unknown> = { userId };
    if (search?.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: rx }, { company: rx }, { role: rx }];
    }
    const rows = await Contact.find(filter).sort({ updatedAt: -1 }).limit(limit ?? 30).lean();
    return json(rows.map((c) => ({
      id: String(c._id),
      name: c.name,
      company: c.company || undefined,
      role: c.role || undefined,
      linkedin: c.linkedinUrl || undefined,
      outreach: c.outreachStatus,
      lastContact: day(c.lastContactDate),
      nextFollowUp: day(c.nextFollowUpDate),
      notes: c.notes || undefined,
    })));
  })());

  server.registerTool("get_master_profile", {
    title: "Get the master profile",
    description: "Their canonical career history — contact, summary, experience with bullets, projects, education, skills, certifications. Resumes are tailored from this.",
    annotations: READ,
  }, run("read", false, async () => {
    const p = await MasterProfile.findOne({ userId }).lean();
    if (!p || !profileHasContent(p as never)) return fail("Their profile is empty — they can upload a resume on the Profile page, or you can merge one in with merge_into_profile.");
    return json({
      contact: p.contact,
      summary: p.summary,
      experiences: p.experiences,
      projects: p.projects,
      education: p.education,
      skills: p.skills,
      certifications: p.certifications,
    });
  }));

  server.registerTool("list_resumes", {
    title: "List resumes",
    description: "Their resumes: uploaded ones and the tailored variants made per application.",
    annotations: READ,
  }, run("read", false, async () => {
    const rows = await Resume.find({ userId }).sort({ updatedAt: -1 }).limit(50).select("name targetRole tags updatedAt").lean();
    return json(rows.map((r) => ({ id: String(r._id), name: r.name, targetRole: r.targetRole || undefined, tailored: (r.tags ?? []).includes("tailored"), updated: day(r.updatedAt) })));
  }));

  server.registerTool("get_resume_document", {
    title: "Get a resume's document",
    description: "A resume's structured document — sections, entries and bullets, each with the id that propose_resume_changes uses.",
    inputSchema: { resumeId: z.string() },
    annotations: READ,
  }, async ({ resumeId }) => run("read", false, async () => {
    if (!mongoose.isValidObjectId(resumeId)) return fail("No resume with that id.");
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) return fail("No resume with that id.");
    const docModel = await loadOrBuildDocument(userId.toString(), resume);
    const d = docModel.document;
    return json({
      name: d.meta.name,
      targetKeywords: docModel.jdKeywords,
      sections: d.sections.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        entries: s.entries.map((e) => ({
          id: e.id,
          title: e.title || undefined,
          org: e.org || undefined,
          dates: [e.startDate, e.current ? "present" : e.endDate].filter(Boolean).join(" – ") || undefined,
          text: s.type === "summary" ? (e.extra as { text?: string } | undefined)?.text : undefined,
          bullets: e.bullets.map((b) => ({ id: b.id, text: b.text })),
        })),
      })),
      pendingProposals: docModel.proposals.length,
    });
  })());

  server.registerTool("get_tailoring_brief", {
    title: "Get a tailoring brief",
    description:
      "Everything needed to tailor one resume: the rules, the target keywords, and each bullet with its id. Use with get_application (for the posting), then send rewrites with propose_resume_changes.",
    inputSchema: {
      resumeId: z.string(),
      instruction: z.string().max(500).optional().describe("What the person asked for, e.g. 'more quantified'."),
    },
    annotations: READ,
  }, async ({ resumeId, instruction }) => run("read", false, async () => {
    if (!mongoose.isValidObjectId(resumeId)) return fail("No resume with that id.");
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) return fail("No resume with that id.");
    const docModel = await loadOrBuildDocument(userId.toString(), resume);
    return json({ ...tailoringBrief(docModel, { scope: "all", instruction }), targetRole: resume.targetRole || undefined });
  })());

  /* ---------------- write ---------------- */

  server.registerTool("add_application", {
    title: "Add an application",
    description:
      "Track a new job. With a posting of 200+ characters HireTrail reads it and runs a fit check, wherever those features run for this person. Fails if the URL is already tracked.",
    inputSchema: {
      company: z.string().min(1).max(200),
      role: z.string().min(1).max(200),
      jobUrl: z.string().url().optional(),
      jobDescription: z.string().max(50_000).optional().describe("The posting text, as written."),
      stage: z.enum(STAGES).optional().describe("Default Applied."),
      location: z.string().max(200).optional(),
      salary: z.string().max(200).optional(),
      notes: z.string().max(5_000).optional(),
    },
    annotations: WRITE,
  }, async (args) => run("write", true, async () => {
    const app = await createApplication(userId, {
      company: args.company,
      role: args.role,
      jobUrl: args.jobUrl ?? "",
      stage: args.stage ?? "Applied",
      jobDescription: args.jobDescription ?? "",
      location: args.location ?? "",
      salary: args.salary ?? "",
      jobType: "",
      notes: args.notes ?? "",
      resumeId: null,
      companyId: null,
      contactId: null,
      outreachStatus: "none",
      source: "manual",
    });
    return json({ id: String(app._id), company: app.company, role: app.role, stage: app.stage, readingPosting: app.aiExtractionStatus === "processing" });
  })());

  server.registerTool("update_application", {
    title: "Update an application",
    description: "Change an application's stage or details. Moving the stage records it in the stage history, as in the app.",
    inputSchema: {
      id: z.string(),
      stage: z.enum(STAGES).optional(),
      company: z.string().min(1).max(200).optional(),
      role: z.string().min(1).max(200).optional(),
      jobUrl: z.string().url().optional(),
      location: z.string().max(200).optional(),
      salary: z.string().max(200).optional(),
      applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD."),
      archived: z.boolean().optional(),
    },
    annotations: { ...WRITE, idempotentHint: true },
  }, async ({ id, ...patch }) => run("write", true, async () => {
    const app = await updateApplication(userId, id, patch);
    return json({ id: String(app._id), company: app.company, role: app.role, stage: app.stage, archived: app.archived });
  })());

  server.registerTool("add_note", {
    title: "Add a note",
    description: "Append a dated note to an application (existing notes are kept).",
    inputSchema: { id: z.string(), note: z.string().min(1).max(2_000) },
    annotations: WRITE,
  }, async ({ id, note }) => run("write", true, async () => {
    if (!mongoose.isValidObjectId(id)) return fail("No application with that id.");
    const a = await Application.findOne({ _id: id, userId }).select("notes");
    if (!a) return fail("No application with that id.");
    const line = `${new Date().toISOString().slice(0, 10)} — ${note.trim()}`;
    const notes = a.notes?.trim() ? `${a.notes.trim()}\n\n${line}` : line;
    if (notes.length > 5_000) return fail("The notes on this application are full (5,000 characters). Ask them to tidy the notes first.");
    await updateApplication(userId, id, { notes });
    return json({ ok: true });
  })());

  server.registerTool("add_deadline", {
    title: "Add a deadline",
    description: "A dated reminder, optionally tied to an application.",
    inputSchema: {
      type: z.enum(DEADLINE_TYPES),
      due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD."),
      applicationId: z.string().optional(),
      notes: z.string().max(2_000).optional(),
    },
    annotations: WRITE,
  }, async ({ type, due, applicationId, notes }) => run("write", true, async () => {
    let appId: mongoose.Types.ObjectId | null = null;
    if (applicationId) {
      if (!mongoose.isValidObjectId(applicationId) || !(await Application.exists({ _id: applicationId, userId }))) return fail("No application with that id.");
      appId = new mongoose.Types.ObjectId(applicationId);
    }
    // A picked day is stored as UTC midnight (services/calendar/days.ts).
    const d = await Deadline.create({ userId, applicationId: appId, type, dueDate: new Date(`${due}T00:00:00.000Z`), notes: notes ?? "" });
    return json({ id: String(d._id), type: d.type, due });
  })());

  server.registerTool("merge_into_profile", {
    title: "Merge into the master profile",
    description:
      "Add experience, projects, education, skills or certifications to their profile. Merged by rules: nothing they already have is dropped or overwritten, and the previous profile is kept for one-click undo. Only add what they told you or what's in a document they gave you.",
    inputSchema: { profile: resumeProfileSchema.partial().describe("The parts to add, in the profile's shape.") },
    annotations: WRITE,
  }, async ({ profile }) => run("write", true, async () => {
    const incoming = resumeProfileSchema.parse({ contact: {}, ...profile });
    const existing = await MasterProfile.findOne({ userId });
    const master = resumeProfileSchema.parse(existing ? existing.toObject() : { contact: {} });
    const merged = mergeByRules(master, incoming);
    await MasterProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...merged,
          lastParsedAt: new Date(),
          lastParsedProvider: "assistant (merged-rules)",
          lastImportSnapshot: existing && profileHasContent(existing) ? { profile: master, savedAt: new Date(), method: "merged" } : null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return json({ ok: true, experiences: merged.experiences.length, projects: merged.projects.length, skills: merged.skills.reduce((n, g) => n + g.items.length, 0), undo: "They can undo it on the Profile page." });
  })());

  server.registerTool("propose_resume_changes", {
    title: "Propose resume changes",
    description:
      "Suggest rewrites of bullets (or the summary) by id — from get_resume_document or get_tailoring_brief. They appear in the Resume Studio for the person to accept; nothing changes until they do. Rewrites that add a number not in the original bullet are dropped.",
    inputSchema: { resumeId: z.string(), items: proposalAnswerSchema.shape.items },
    annotations: WRITE,
  }, async ({ resumeId, items }) => run("write", true, async () => {
    if (!mongoose.isValidObjectId(resumeId)) return fail("No resume with that id.");
    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) return fail("No resume with that id.");
    const decision = await laneFor(ctx.user, "resume.tailor");
    if (decision.refusal) return fail(decision.refusal.custom ?? "Tailoring isn't available on this account.");
    const docModel = await loadOrBuildDocument(userId.toString(), resume);
    const { proposals, dropped } = await proposeFromAssistant(docModel, { items });
    return json({
      proposed: proposals.length,
      dropped,
      note: dropped ? "Some rewrites added numbers that aren't in the original bullets, so they were dropped." : undefined,
      next: proposals.length ? "Tell them to review the suggestions in the Resume Studio." : undefined,
    });
  })());

  /* ---------------- AI tasks (the assistant lane) ---------------- */

  server.registerTool("list_ai_tasks", {
    title: "List AI tasks",
    description: "AI work waiting for this assistant — features the person runs here instead of on HireTrail's AI. Oldest first.",
    annotations: READ,
  }, run("ai", false, async () => {
    const jobs = await assistantQueue(userId, 20);
    // Say what each task is about in the person's terms ("Fit check · Engineer at Initech").
    const sessionIds = jobs.filter((j) => j.refType === "tailorSession").map((j) => j.refId);
    const appIds = jobs.filter((j) => j.refType === "application").map((j) => j.refId);
    const [sessions, apps] = await Promise.all([
      TailorSession.find({ _id: { $in: sessionIds } }).select("jobTitle company").lean(),
      Application.find({ _id: { $in: appIds } }).select("role company").lean(),
    ]);
    const about = (j: (typeof jobs)[number]): string | undefined => {
      const id = String(j.refId);
      if (j.refType === "tailorSession") {
        const s = sessions.find((x) => String(x._id) === id);
        return s ? [s.jobTitle, s.company].filter(Boolean).join(" at ") : undefined;
      }
      if (j.refType === "application") {
        const a = apps.find((x) => String(x._id) === id);
        return a ? `${a.role} at ${a.company}` : undefined;
      }
      if (j.refType === "masterProfile") return "Importing a resume into their profile";
      return undefined;
    };
    return json(jobs.map((j) => ({ taskId: String(j._id), feature: aiFeature(j.feature).label, about: about(j), waitingSince: j.createdAt })));
  }));

  server.registerTool("start_ai_task", {
    title: "Start an AI task",
    description: "Claim one waiting task (15 minutes). Returns the instructions, the input and the exact JSON shape finish_ai_task expects.",
    inputSchema: { taskId: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ taskId }) => run("ai", false, async () => {
    const { job, brief, schema } = await claimForAssistant(userId, taskId, `mcp:${ctx.token._id}`);
    return json({
      taskId: String(job._id),
      feature: aiFeature(job.feature).label,
      instructions: brief.instructions,
      input: brief.context,
      answerSchema: await zodSchema(schema).jsonSchema,
      then: "Call finish_ai_task with { taskId, answer } — answer must match answerSchema.",
    });
  })());

  server.registerTool("finish_ai_task", {
    title: "Finish an AI task",
    description: "Submit the answer for a task you started. A wrong shape is refused with what to fix, and the claim stays yours to try again.",
    inputSchema: { taskId: z.string(), answer: z.record(z.unknown()).describe("The answer, matching the task's answerSchema.") },
    annotations: WRITE,
  }, async ({ taskId, answer }) => run("ai", true, async () => {
    const result = await submitFromAssistant(userId, taskId, `mcp:${ctx.token._id}`, answer);
    return json({ ok: true, result });
  })());

  /* ---------------- prompts ---------------- */

  server.registerPrompt("do_my_ai_tasks", {
    title: "Do my HireTrail AI tasks",
    description: "Pick up every AI task waiting for this assistant and finish them.",
  }, () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Do my waiting HireTrail AI tasks: call list_ai_tasks, then for each one start_ai_task, do the work exactly as instructed (never invent facts), and finish_ai_task. Tell me what you did when you're done.",
      },
    }],
  }));

  server.registerPrompt("tailor_resume", {
    title: "Tailor a resume for a job",
    description: "Propose rewrites of a resume for one application, to accept in the Studio.",
    argsSchema: { applicationId: z.string().describe("The application to tailor for."), resumeId: z.string().describe("The resume to tailor.") },
  }, ({ applicationId, resumeId }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Tailor my resume ${resumeId} for application ${applicationId}: read the posting with get_application, get the rules and bullets with get_tailoring_brief, then send rewrites with propose_resume_changes. Only reword what's there — no new facts or numbers. Then tell me to review them in the Resume Studio.`,
      },
    }],
  }));

  server.registerPrompt("weekly_review", {
    title: "Weekly job-search review",
    description: "Where the search stands, what's due, what to follow up on.",
  }, () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Give me my weekly job-search review from HireTrail: use whoami, list_applications and list_deadlines. Summarise the pipeline by stage, what's due or overdue this week, and applications that have gone quiet and need a follow-up. Keep it short.",
      },
    }],
  }));

  return server;
}
