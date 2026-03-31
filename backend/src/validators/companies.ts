import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  website: z.string().url().or(z.literal("")).default(""),
  industry: z.string().max(100).default(""),
  notes: z.string().max(5000).default(""),
  blacklisted: z.boolean().default(false),
  blacklistReason: z.string().max(500).default(""),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  industry: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  blacklisted: z.boolean().optional(),
  blacklistReason: z.string().max(500).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
