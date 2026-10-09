import { z } from "zod";
import { STAGES, OUTREACH_STATUSES, ARCHIVE_REASONS, APPLICATION_SOURCES } from "../models/Application.js";

// Transform empty strings to null for optional reference fields
const optionalRef = z.string().nullable().default(null).transform((v) => (v === "" ? null : v));

/** A picked day (YYYY-MM-DD, stored as UTC midnight) or an ISO moment — see
 *  `parseApplicationDate` in services/applications/write.ts. */
const applicationDate = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"));

export const createApplicationSchema = z.object({
  company: z.string().min(1, "Company is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  jobUrl: z.string().url().or(z.literal("")).default(""),
  stage: z.enum(STAGES).default("Applied"),
  jobDescription: z.string().max(50000).default(""),
  location: z.string().max(200).default(""),
  salary: z.string().max(200).default(""),
  jobType: z.string().max(200).default(""),
  notes: z.string().max(5000).default(""),
  resumeId: optionalRef,
  companyId: optionalRef,
  contactId: optionalRef,
  outreachStatus: z.enum(OUTREACH_STATUSES).default("none"),
  source: z.enum(APPLICATION_SOURCES).default("manual"),
  /** Backdates the application (its history starts on this day too). */
  applicationDate: applicationDate.optional(),
});

const optionalRefUpdate = z.string().nullable().optional().transform((v) => (v === "" ? null : v));

export const updateApplicationSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  jobUrl: z.string().url().or(z.literal("")).optional(),
  stage: z.enum(STAGES).optional(),
  jobDescription: z.string().max(50000).optional(),
  location: z.string().max(200).optional(),
  salary: z.string().max(200).optional(),
  jobType: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  applicationDate: applicationDate.optional(),
  resumeId: optionalRefUpdate,
  companyId: optionalRefUpdate,
  contactId: optionalRefUpdate,
  outreachStatus: z.enum(OUTREACH_STATUSES).optional(),
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  archivedReason: z.enum(ARCHIVE_REASONS).nullable().optional(),
});

/** PUT /applications/:id/archive. Old clients send no body at all. */
export const archiveApplicationSchema = z.object({
  reason: z.enum(ARCHIVE_REASONS).default("manual"),
}).default({});

const batchIds = z.array(z.string().regex(/^[0-9a-f]{24}$/i, "Invalid application id")).min(1).max(1000);

/** POST /applications/batch — one action over many of the person's applications. */
export const batchApplicationsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive"), ids: batchIds, reason: z.enum(ARCHIVE_REASONS).default("manual") }),
  z.object({ action: z.literal("unarchive"), ids: batchIds }),
  z.object({ action: z.literal("delete"), ids: batchIds }),
  z.object({ action: z.literal("stage"), ids: batchIds, stage: z.enum(STAGES) }),
  z.object({ action: z.literal("undoStage"), ids: batchIds }),
]);

/** POST /applications/bulk (CSV import). Only the envelope is checked here —
 *  each row is parsed on its own with `importRowSchema`, so one bad row is
 *  skipped and reported instead of failing the file. */
export const importApplicationsSchema = z.object({
  applications: z.array(z.unknown(), { invalid_type_error: "applications must be a non-empty array" })
    .min(1, "applications must be a non-empty array")
    .max(500, "Maximum 500 applications per import"),
});

/** Spreadsheet cells: missing or null reads as empty. */
const cell = (max: number) => z.string().trim().max(max).nullish().transform((v) => v ?? "");

/** A spreadsheet's job URL: kept when it's a web address (a bare
 *  "careers.acme.com/123" gets https://), dropped otherwise — "N/A" isn't a
 *  link, and every such row would read as a duplicate of the others. */
function importJobUrl(value: string): string {
  if (!value) return "";
  const url = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === "https:" || protocol === "http:") && hostname.includes(".") ? url : "";
  } catch {
    return "";
  }
}

export const importRowSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  jobUrl: cell(2000).transform(importJobUrl),
  // Stage names match case-insensitively; an empty or null cell means Applied.
  stage: z.preprocess(
    (v) => (typeof v === "string" ? STAGES.find((s) => s.toLowerCase() === v.trim().toLowerCase()) ?? (v.trim() || undefined) : v ?? undefined),
    z.enum(STAGES).default("Applied"),
  ),
  applicationDate: cell(100),
  notes: cell(5000),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type BatchApplicationsInput = z.infer<typeof batchApplicationsSchema>;
export type ImportRow = z.infer<typeof importRowSchema>;
