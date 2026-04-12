import { z } from "zod";
import { STAGES, OUTREACH_STATUSES, ARCHIVE_REASONS } from "../models/Application.js";

// Transform empty strings to null for optional reference fields
const optionalRef = z.string().nullable().default(null).transform((v) => (v === "" ? null : v));

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
  resumeId: optionalRefUpdate,
  companyId: optionalRefUpdate,
  contactId: optionalRefUpdate,
  outreachStatus: z.enum(OUTREACH_STATUSES).optional(),
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  archivedReason: z.enum(ARCHIVE_REASONS).nullable().optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
