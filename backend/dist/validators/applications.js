import { z } from "zod";
import { STAGES } from "../models/Application.js";
export const createApplicationSchema = z.object({
    company: z.string().min(1, "Company is required").max(200),
    role: z.string().min(1, "Role is required").max(200),
    jobUrl: z.string().url().or(z.literal("")).default(""),
    stage: z.enum(STAGES).default("Applied"),
    notes: z.string().max(5000).default(""),
    resumeId: z.string().nullable().default(null),
});
export const updateApplicationSchema = z.object({
    company: z.string().min(1).max(200).optional(),
    role: z.string().min(1).max(200).optional(),
    jobUrl: z.string().url().or(z.literal("")).optional(),
    stage: z.enum(STAGES).optional(),
    notes: z.string().max(5000).optional(),
    resumeId: z.string().nullable().optional(),
});
//# sourceMappingURL=applications.js.map