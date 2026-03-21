import { z } from "zod";

export const createDeadlineSchema = z.object({
  applicationId: z.string().nullable().default(null),
  type: z.string().min(1, "Type is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().max(2000).default(""),
});

export const updateDeadlineSchema = z.object({
  applicationId: z.string().nullable().optional(),
  type: z.string().min(1).optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateDeadlineInput = z.infer<typeof createDeadlineSchema>;
export type UpdateDeadlineInput = z.infer<typeof updateDeadlineSchema>;
