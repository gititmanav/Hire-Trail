import { z } from "zod";
export declare const userRoleSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "admin"]>;
}, "strip", z.ZodTypeAny, {
    role: "user" | "admin";
}, {
    role: "user" | "admin";
}>;
export declare const announcementSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["info", "warning", "success"]>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodString;
    dismissible: z.ZodDefault<z.ZodBoolean>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "info" | "warning" | "success";
    title: string;
    body: string;
    endDate: string;
    dismissible: boolean;
    active: boolean;
    startDate?: string | undefined;
}, {
    title: string;
    body: string;
    endDate: string;
    type?: "info" | "warning" | "success" | undefined;
    startDate?: string | undefined;
    dismissible?: boolean | undefined;
    active?: boolean | undefined;
}>;
export declare const updateAnnouncementSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["info", "warning", "success"]>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    dismissible: z.ZodOptional<z.ZodBoolean>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type?: "info" | "warning" | "success" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    dismissible?: boolean | undefined;
    active?: boolean | undefined;
}, {
    type?: "info" | "warning" | "success" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    dismissible?: boolean | undefined;
    active?: boolean | undefined;
}>;
export declare const systemSettingSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodAny;
    valueType: z.ZodOptional<z.ZodEnum<["string", "number", "boolean", "json"]>>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    key: string;
    value?: any;
    description?: string | undefined;
    valueType?: "string" | "number" | "boolean" | "json" | undefined;
    category?: string | undefined;
}, {
    key: string;
    value?: any;
    description?: string | undefined;
    valueType?: "string" | "number" | "boolean" | "json" | undefined;
    category?: string | undefined;
}>;
export declare const inviteSchema: z.ZodObject<{
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    maxUses: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    maxUses: number;
    expiresAt: string;
    email?: string | null | undefined;
}, {
    expiresAt: string;
    email?: string | null | undefined;
    maxUses?: number | undefined;
}>;
export declare const emailTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    subject: z.ZodString;
    bodyHtml: z.ZodString;
    variables: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    type: z.ZodEnum<["welcome", "reset", "suspend", "reminder", "digest"]>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "suspend" | "welcome" | "reset" | "reminder" | "digest";
    name: string;
    active: boolean;
    subject: string;
    bodyHtml: string;
    variables: string[];
}, {
    type: "suspend" | "welcome" | "reset" | "reminder" | "digest";
    name: string;
    subject: string;
    bodyHtml: string;
    active?: boolean | undefined;
    variables?: string[] | undefined;
}>;
export declare const updateEmailTemplateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    bodyHtml: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    type: z.ZodOptional<z.ZodEnum<["welcome", "reset", "suspend", "reminder", "digest"]>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type?: "suspend" | "welcome" | "reset" | "reminder" | "digest" | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    subject?: string | undefined;
    bodyHtml?: string | undefined;
    variables?: string[] | undefined;
}, {
    type?: "suspend" | "welcome" | "reset" | "reminder" | "digest" | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    subject?: string | undefined;
    bodyHtml?: string | undefined;
    variables?: string[] | undefined;
}>;
