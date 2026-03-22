import { z } from "zod";
export declare const createDeadlineSchema: z.ZodObject<{
    applicationId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    type: z.ZodString;
    dueDate: z.ZodString;
    notes: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    notes: string;
    applicationId: string | null;
    dueDate: string;
}, {
    type: string;
    dueDate: string;
    notes?: string | undefined;
    applicationId?: string | null | undefined;
}>;
export declare const updateDeadlineSchema: z.ZodObject<{
    applicationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    completed: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    notes?: string | undefined;
    applicationId?: string | null | undefined;
    dueDate?: string | undefined;
    completed?: boolean | undefined;
}, {
    type?: string | undefined;
    notes?: string | undefined;
    applicationId?: string | null | undefined;
    dueDate?: string | undefined;
    completed?: boolean | undefined;
}>;
export type CreateDeadlineInput = z.infer<typeof createDeadlineSchema>;
export type UpdateDeadlineInput = z.infer<typeof updateDeadlineSchema>;
