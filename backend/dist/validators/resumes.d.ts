import { z } from "zod";
export declare const createResumeSchema: z.ZodObject<{
    name: z.ZodString;
    targetRole: z.ZodDefault<z.ZodString>;
    fileName: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    targetRole: string;
    fileName: string;
}, {
    name: string;
    targetRole?: string | undefined;
    fileName?: string | undefined;
}>;
export declare const updateResumeSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    targetRole: z.ZodOptional<z.ZodString>;
    fileName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    targetRole?: string | undefined;
    fileName?: string | undefined;
}, {
    name?: string | undefined;
    targetRole?: string | undefined;
    fileName?: string | undefined;
}>;
export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
