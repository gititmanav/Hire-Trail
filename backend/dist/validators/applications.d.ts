import { z } from "zod";
export declare const createApplicationSchema: z.ZodObject<{
    company: z.ZodString;
    role: z.ZodString;
    jobUrl: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    stage: z.ZodDefault<z.ZodEnum<["Applied", "OA", "Interview", "Offer", "Rejected"]>>;
    notes: z.ZodDefault<z.ZodString>;
    resumeId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    stage: "Applied" | "OA" | "Interview" | "Offer" | "Rejected";
    company: string;
    role: string;
    jobUrl: string;
    notes: string;
    resumeId: string | null;
}, {
    company: string;
    role: string;
    stage?: "Applied" | "OA" | "Interview" | "Offer" | "Rejected" | undefined;
    jobUrl?: string | undefined;
    notes?: string | undefined;
    resumeId?: string | null | undefined;
}>;
export declare const updateApplicationSchema: z.ZodObject<{
    company: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    jobUrl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    stage: z.ZodOptional<z.ZodEnum<["Applied", "OA", "Interview", "Offer", "Rejected"]>>;
    notes: z.ZodOptional<z.ZodString>;
    resumeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    stage?: "Applied" | "OA" | "Interview" | "Offer" | "Rejected" | undefined;
    company?: string | undefined;
    role?: string | undefined;
    jobUrl?: string | undefined;
    notes?: string | undefined;
    resumeId?: string | null | undefined;
}, {
    stage?: "Applied" | "OA" | "Interview" | "Offer" | "Rejected" | undefined;
    company?: string | undefined;
    role?: string | undefined;
    jobUrl?: string | undefined;
    notes?: string | undefined;
    resumeId?: string | null | undefined;
}>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
