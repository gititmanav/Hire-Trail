import { z } from "zod";
export declare const createCompanySchema: z.ZodObject<{
    name: z.ZodString;
    website: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    website: string;
}, {
    name: string;
    website?: string | undefined;
}>;
export declare const updateCompanySchema: z.ZodObject<{
    website: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    domain: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    website?: string | undefined;
    domain?: string | undefined;
}, {
    website?: string | undefined;
    domain?: string | undefined;
}>;
