import { z } from "zod";

export const createResumeSchema = z.object({
  name: z.string().min(1, "Resume name is required").max(100),
  targetRole: z.string().max(100).default(""),
  fileName: z.string().default(""),
});

export const updateResumeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetRole: z.string().max(100).optional(),
  fileName: z.string().optional(),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
