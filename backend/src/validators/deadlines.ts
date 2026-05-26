import { z } from "zod";

export const createDeadlineSchema = z.object({
  applicationId: z.string().nullable().default(null),
  type: z.string().min(1, "Type is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().max(2000).default(""),
  /** 0 = one-off, >0 = repeats every N days (capped at 365). Used by the
   *  "Follow up every 2 weeks until response" loop. */
  recurrenceDays: z.number().int().min(0).max(365).default(0),
});

export const updateDeadlineSchema = z.object({
  applicationId: z.string().nullable().optional(),
  type: z.string().min(1).optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  recurrenceDays: z.number().int().min(0).max(365).optional(),
});

export type CreateDeadlineInput = z.infer<typeof createDeadlineSchema>;
export type UpdateDeadlineInput = z.infer<typeof updateDeadlineSchema>;
