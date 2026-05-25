import { z } from "zod";
import { CONTACT_OUTREACH_STATUSES, CONTACT_SOURCES } from "../models/Contact.js";

/** Accepts "" | ISO date ("2026-05-25") | ISO datetime; rejects gibberish. */
const dateOrEmpty = z
  .string()
  .refine((s) => s === "" || !isNaN(Date.parse(s)), { message: "Invalid date" });

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  company: z.string().min(1, "Company is required").max(200),
  role: z.string().max(100).default(""),
  linkedinUrl: z.string().url().or(z.literal("")).default(""),
  connectionSource: z.string().default(""),
  notes: z.string().max(5000).default(""),
  companyId: z.string().nullable().default(null),
  applicationIds: z.array(z.string()).default([]),
  outreachStatus: z.enum(CONTACT_OUTREACH_STATUSES).default("not_contacted"),
  nextFollowUpDate: dateOrEmpty.nullable().default(null),
  source: z.enum(CONTACT_SOURCES).default("manual"),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  company: z.string().min(1).max(200).optional(),
  role: z.string().max(100).optional(),
  linkedinUrl: z.string().url().or(z.literal("")).optional(),
  connectionSource: z.string().optional(),
  lastContactDate: dateOrEmpty.optional(),
  notes: z.string().max(5000).optional(),
  companyId: z.string().nullable().optional(),
  applicationIds: z.array(z.string()).optional(),
  outreachStatus: z.enum(CONTACT_OUTREACH_STATUSES).optional(),
  lastOutreachDate: dateOrEmpty.nullable().optional(),
  nextFollowUpDate: dateOrEmpty.nullable().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
