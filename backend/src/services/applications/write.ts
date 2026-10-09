/**
 * The one write path for applications — the REST routes and the MCP tools
 * both call these, so an application added from Claude Code gets the same
 * company linking, duplicate check, stage history and AI pipeline as one
 * added in the app.
 */
import mongoose from "mongoose";

import { Application, type ArchiveReason, type IApplication } from "../../models/Application.js";
import { Company } from "../../models/Company.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { Resume } from "../../models/Resume.js";
import { ResumeDocument } from "../../models/ResumeDocument.js";
import { TailorSession } from "../../models/TailorSession.js";
import { User } from "../../models/User.js";
import { AppError, NotFoundError } from "../../errors/AppError.js";
import { ensureCompanyLogo } from "../../routes/companies.js";
import { extractDomainFromUrl, isJobBoardDomain } from "../../utils/companyDomain.js";
import { enrichNewApplication, willReadPosting } from "../ai/features/postingRead.js";
import {
  importRowSchema,
  type CreateApplicationInput,
  type ImportRow,
  type UpdateApplicationInput,
} from "../../validators/applications.js";

const DEMO_EMAIL = "demo@hiretrail.com";

/** Domain to STORE on a Company doc derived from an Application's jobUrl.
 *  "" for known job-board hosts (Workday, Greenhouse, …) so the logo fetcher
 *  falls back to a name-derived domain instead of pulling the ATS's logo. */
export function companyDomainFromJobUrl(jobUrl?: string | null): string {
  if (!jobUrl) return "";
  const d = extractDomainFromUrl(jobUrl);
  if (!d || isJobBoardDomain(d)) return "";
  return d;
}

/** Website to STORE on a Company doc derived from a jobUrl (empty for boards). */
export function companyWebsiteFromJobUrl(jobUrl?: string | null): string {
  if (!jobUrl) return "";
  try {
    const u = new URL(jobUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (isJobBoardDomain(host)) return "";
    return u.origin;
  } catch {
    return "";
  }
}

async function linkCompany(name: string, jobUrl: string | undefined, userId: mongoose.Types.ObjectId, website: string) {
  return Company.findOneAndUpdate(
    { name: name.trim() },
    {
      $setOnInsert: { name: name.trim(), website, domain: companyDomainFromJobUrl(jobUrl), createdBy: userId },
      $addToSet: { users: userId },
    },
    { upsert: true, new: true, collation: { locale: "en", strength: 2 } },
  );
}

export class DuplicateApplicationError extends AppError {
  constructor(public readonly applicationId: mongoose.Types.ObjectId) {
    super("Already tracked", 409, { code: "duplicate", details: { applicationId: applicationId.toString() } });
  }
}

/** Extension builds before 1.5 wrote rule-based "[Auto Tags]" / "[LLM Tags]"
 *  blocks into the notes of every tracked job. The posting read fills real
 *  fields now; those blocks are dropped so notes stay the person's own. */
function stripLegacyTagNotes(notes: string): string {
  return notes
    .split(/\n{2,}/)
    .filter((block) => !/^\[(Auto|LLM) Tags\]/.test(block.trim()))
    .join("\n\n")
    .trim();
}

/**
 * Create an application. The response can go out as soon as this returns:
 * the logo fetch and the AI pipeline (posting read → fit check) run on.
 */
export async function createApplication(userId: mongoose.Types.ObjectId, input: CreateApplicationInput): Promise<IApplication> {
  if (input.jobUrl) {
    const existing = await Application.findOne({ userId, jobUrl: input.jobUrl }).select("_id").lean();
    if (existing) throw new DuplicateApplicationError(existing._id);
  }

  let companyId = input.companyId || null;
  let company = null;
  if (!companyId && input.company) {
    company = await linkCompany(input.company, input.jobUrl, userId, companyWebsiteFromJobUrl(input.jobUrl));
    companyId = company._id.toString();
  }

  // The demo account never reaches the AI pipeline (its fit checks are seeded).
  const isDemoUser = (await User.findById(userId).select("email").lean())?.email === DEMO_EMAIL;
  // A backdated application's history starts on its applied day, too.
  const { applicationDate, ...fields } = input;
  const appliedAt = applicationDate ? parseApplicationDate(applicationDate) : null;
  // Seed "processing" when the posting read will run, so the create response
  // already carries it and the client shows "Reading this posting…" at once.
  const app = await Application.create({
    ...fields,
    ...(appliedAt && { applicationDate: appliedAt, stageHistory: [{ stage: fields.stage, date: appliedAt }] }),
    notes: input.source === "extension" && input.notes ? stripLegacyTagNotes(input.notes) : input.notes,
    userId,
    companyId,
    resumeId: input.resumeId || null,
    aiExtractionStatus: willReadPosting(input, isDemoUser) ? "processing" : "idle",
  });

  if (company) void ensureCompanyLogo(company).catch(() => undefined);
  void enrichNewApplication(app, { isDemoUser });
  return app;
}

/** A picked day (YYYY-MM-DD) is stored as UTC midnight — a plain day (see
 *  services/calendar/days.ts); an ISO datetime is a moment, stored as given. */
function parseApplicationDate(value: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateApplication(
  userId: mongoose.Types.ObjectId,
  id: string,
  data: UpdateApplicationInput,
): Promise<IApplication> {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Application");
  const existing = await Application.findOne({ _id: id, userId });
  if (!existing) throw new NotFoundError("Application");

  if (data.stage && data.stage !== existing.stage) {
    existing.stageHistory.push({ stage: data.stage, date: new Date() });
    existing.stage = data.stage;
  }
  if (data.company !== undefined) {
    // The name owns the link: the edit form echoes the companyId it loaded,
    // which would undo a relink, so an incoming companyId is ignored here.
    // Only a new name — or a legacy doc that was never linked — needs one
    // (same job-board guard as create).
    const name = data.company.trim();
    if (name !== existing.company || !existing.companyId) {
      existing.company = name;
      const company = await linkCompany(name, data.jobUrl ?? existing.jobUrl, userId, "");
      existing.companyId = company._id;
    }
  } else if (data.companyId !== undefined) {
    existing.companyId = data.companyId as never;
  }
  if (data.role !== undefined) existing.role = data.role;
  if (data.jobUrl !== undefined) existing.jobUrl = data.jobUrl;
  if (data.applicationDate !== undefined) {
    const d = parseApplicationDate(data.applicationDate);
    if (d) existing.applicationDate = d;
  }
  if (data.jobDescription !== undefined) existing.jobDescription = data.jobDescription;
  if (data.location !== undefined) existing.location = data.location;
  if (data.salary !== undefined) existing.salary = data.salary;
  if (data.jobType !== undefined) existing.jobType = data.jobType;
  if (data.notes !== undefined) existing.notes = data.notes;
  if (data.resumeId !== undefined) existing.resumeId = data.resumeId as never;
  if (data.contactId !== undefined) existing.contactId = data.contactId as never;
  if (data.outreachStatus !== undefined) existing.outreachStatus = data.outreachStatus;
  if (data.archived !== undefined) existing.archived = data.archived;
  if (data.archivedAt !== undefined) existing.archivedAt = data.archivedAt ? new Date(data.archivedAt) : null;
  if (data.archivedReason !== undefined) existing.archivedReason = data.archivedReason;
  await existing.save();
  return existing;
}

/** What archiving sets — the single route and the batch alike. */
export function archivedFields(reason: ArchiveReason) {
  return { archived: true, archivedAt: new Date(), archivedReason: reason };
}

export const UNARCHIVED_FIELDS = { archived: false, archivedAt: null, archivedReason: null };

/**
 * Delete applications and what hangs off them: their deadlines, their links
 * on contacts, and their fit checks. Resumes are never touched — a tailored
 * variant is the person's own document — and a fit check a resume still
 * points at stays as that resume's (unlinked from the application). Returns
 * how many applications were deleted.
 */
export async function deleteApplications(userId: mongoose.Types.ObjectId, ids: mongoose.Types.ObjectId[]): Promise<number> {
  const owned = (await Application.find({ _id: { $in: ids }, userId }).select("_id").lean()).map((a) => a._id);
  if (!owned.length) return 0;
  const { deletedCount } = await Application.deleteMany({ _id: { $in: owned }, userId });

  const sessionIds = (await TailorSession.find({ userId, applicationId: { $in: owned } }).select("_id").lean()).map((s) => s._id);
  const [byResume, byDocument] = sessionIds.length
    ? await Promise.all([
        Resume.distinct("tailorSessionId", { userId, tailorSessionId: { $in: sessionIds } }),
        ResumeDocument.distinct("tailorSessionId", { userId, tailorSessionId: { $in: sessionIds } }),
      ])
    : [[], []];
  const kept = new Set([...byResume, ...byDocument].map(String));
  await Promise.all([
    Deadline.deleteMany({ userId, applicationId: { $in: owned } }),
    Contact.updateMany({ userId, applicationIds: { $in: owned } }, { $pull: { applicationIds: { $in: owned } } }),
    TailorSession.deleteMany({ userId, _id: { $in: sessionIds.filter((id) => !kept.has(String(id))) } }),
    // A kept one becomes the resume's alone, like a Studio analysis.
    TailorSession.updateMany({ userId, _id: { $in: [...kept] } }, { $set: { applicationId: null } }),
  ]);
  return deletedCount;
}

/** A spreadsheet date. A plain day — "2025-03-15", "3/15/2025", "Mar 15,
 *  2025" — is stored as UTC midnight, like a picked day; a timestamp is a
 *  moment. The engine reads a plain day as local midnight, so its local
 *  date is the day that was written. */
function parseImportDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /\d:\d{2}/.test(value)) return parseApplicationDate(value);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export interface ImportResult {
  count: number;
  /** Rows whose job URL is already tracked, or repeats earlier in the file. */
  duplicates: number;
  /** One line per row that couldn't be read ("Row 3: Company is required"). */
  errors: string[];
}

/**
 * The CSV import. Each row is read on its own — a bad one is skipped with a
 * reason, never a failed file — and a job URL that's already tracked is
 * skipped as `createApplication` refuses it. Companies link through the same
 * shared directory, once per name. Rows carry no posting, so there's no AI
 * pass; company logos load on demand (POST /companies/:id/logo).
 */
export async function importApplications(userId: mongoose.Types.ObjectId, rows: unknown[]): Promise<ImportResult> {
  const errors: string[] = [];
  const valid: Array<ImportRow & { appliedAt: Date }> = [];
  rows.forEach((row, i) => {
    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`Row ${i + 1}: ${issue.path.length ? `${issue.path.join(".")} — ` : ""}${issue.message}`);
      return;
    }
    const appliedAt = parsed.data.applicationDate ? parseImportDate(parsed.data.applicationDate) : new Date();
    if (!appliedAt) {
      errors.push(`Row ${i + 1}: "${parsed.data.applicationDate}" isn't a date`);
      return;
    }
    valid.push({ ...parsed.data, appliedAt });
  });

  const urls = [...new Set(valid.map((r) => r.jobUrl).filter(Boolean))];
  const tracked = new Set(
    urls.length ? (await Application.find({ userId, jobUrl: { $in: urls } }).select("jobUrl").lean()).map((a) => a.jobUrl) : [],
  );
  const fresh = valid.filter((r) => {
    if (!r.jobUrl) return true;
    if (tracked.has(r.jobUrl)) return false;
    tracked.add(r.jobUrl);
    return true;
  });

  // The directory matches names case-insensitively — one link per name.
  const firstByName = new Map<string, ImportRow>();
  for (const r of fresh) if (!firstByName.has(r.company.toLowerCase())) firstByName.set(r.company.toLowerCase(), r);
  const companyIds = new Map(
    await Promise.all([...firstByName].map(async ([key, r]) => {
      const company = await linkCompany(r.company, r.jobUrl, userId, companyWebsiteFromJobUrl(r.jobUrl));
      return [key, company._id] as const;
    })),
  );

  if (fresh.length) {
    await Application.insertMany(fresh.map((r) => ({
      userId,
      company: r.company,
      companyId: companyIds.get(r.company.toLowerCase()) ?? null,
      role: r.role,
      jobUrl: r.jobUrl,
      applicationDate: r.appliedAt,
      stage: r.stage,
      stageHistory: [{ stage: r.stage, date: r.appliedAt }],
      notes: r.notes,
      resumeId: null,
    })));
  }
  return { count: fresh.length, duplicates: valid.length - fresh.length, errors };
}
