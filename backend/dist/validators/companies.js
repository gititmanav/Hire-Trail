import { z } from "zod";
export const createCompanySchema = z.object({
    name: z.string().min(1, "Company name is required").max(200),
    website: z.string().url().or(z.literal("")).default(""),
});
export const updateCompanySchema = z.object({
    website: z.string().url().or(z.literal("")).optional(),
    domain: z.string().max(200).optional(),
});
//# sourceMappingURL=companies.js.map