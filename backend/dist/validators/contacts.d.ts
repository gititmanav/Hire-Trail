import { z } from "zod";
export declare const createContactSchema: z.ZodObject<{
    name: z.ZodString;
    company: z.ZodString;
    role: z.ZodDefault<z.ZodString>;
    linkedinUrl: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    connectionSource: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    company: string;
    role: string;
    notes: string;
    linkedinUrl: string;
    connectionSource: string;
}, {
    name: string;
    company: string;
    role?: string | undefined;
    notes?: string | undefined;
    linkedinUrl?: string | undefined;
    connectionSource?: string | undefined;
}>;
export declare const updateContactSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    linkedinUrl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    connectionSource: z.ZodOptional<z.ZodString>;
    lastContactDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    company?: string | undefined;
    role?: string | undefined;
    notes?: string | undefined;
    linkedinUrl?: string | undefined;
    connectionSource?: string | undefined;
    lastContactDate?: string | undefined;
}, {
    name?: string | undefined;
    company?: string | undefined;
    role?: string | undefined;
    notes?: string | undefined;
    linkedinUrl?: string | undefined;
    connectionSource?: string | undefined;
    lastContactDate?: string | undefined;
}>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
