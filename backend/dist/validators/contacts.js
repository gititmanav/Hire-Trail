import { z } from "zod";
import { CONTACT_OUTREACH_STATUSES } from "../models/Contact.js";
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
    nextFollowUpDate: z.string().datetime().nullable().default(null),
});
export const updateContactSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    company: z.string().min(1).max(200).optional(),
    role: z.string().max(100).optional(),
    linkedinUrl: z.string().url().or(z.literal("")).optional(),
    connectionSource: z.string().optional(),
    lastContactDate: z.string().datetime().optional(),
    notes: z.string().max(5000).optional(),
    companyId: z.string().nullable().optional(),
    applicationIds: z.array(z.string()).optional(),
    outreachStatus: z.enum(CONTACT_OUTREACH_STATUSES).optional(),
    lastOutreachDate: z.string().datetime().nullable().optional(),
    nextFollowUpDate: z.string().datetime().nullable().optional(),
});
//# sourceMappingURL=contacts.js.map