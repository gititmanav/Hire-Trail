import { z } from "zod";

/** A date OR datetime string. The admin UI uses <input type="date"> (sends
 *  "YYYY-MM-DD"), while API clients may send a full ISO timestamp — both are
 *  valid here. The route casts with `new Date(...)`, so anything Date-parseable
 *  is safe. (`z.string().datetime()` rejected the date-only picker value.) */
const dateLike = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date" });

export const userRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  type: z.enum(["info", "warning", "success"]).default("info"),
  startDate: dateLike.optional(),
  endDate: dateLike,
  dismissible: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  type: z.enum(["info", "warning", "success"]).optional(),
  startDate: dateLike.optional(),
  endDate: dateLike.optional(),
  dismissible: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const systemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  valueType: z.enum(["string", "number", "boolean", "json"]).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});
