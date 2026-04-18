import { z } from "zod";
import "dotenv/config";

const localhostLike = /localhost|127\.0\.0\.1/i;

const envSchema = z
  .object({
    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
    PORT: z.string().default("5050"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    CLIENT_URL: z.string().default("http://localhost:5173"),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    GOOGLE_CALLBACK_URL: z.string().default("http://localhost:5050/api/auth/google/callback"),
    // Optional: resume PDF storage
    CLOUDINARY_CLOUD_NAME: z.string().default(""),
    CLOUDINARY_API_KEY: z.string().default(""),
    CLOUDINARY_API_SECRET: z.string().default(""),
    // Optional: RapidAPI JSearch proxy
    JSEARCH_API_KEY: z.string().default(""),
    ADMIN_EMAILS: z.string().default(""),
    /** Single email allowed to sign in and use the API while `maintenance_mode` is on. Empty = no bypass. */
    MAINTENANCE_BYPASS_EMAIL: z.string().default("manavkaneria@gmail.com"),
    GMAIL_REDIRECT_URI: z.string().default("http://localhost:5050/api/email/callback"),
    ENCRYPTION_KEY: z.string().default("0000000000000000000000000000000000000000000000000000000000000000"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    if (localhostLike.test(data.CLIENT_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "CLIENT_URL must be your public site URL in production (e.g. https://your-app.vercel.app), not localhost.",
        path: ["CLIENT_URL"],
      });
    }

    const googleEnabled = Boolean(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET);
    if (googleEnabled && localhostLike.test(data.GOOGLE_CALLBACK_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "GOOGLE_CALLBACK_URL must be your public API callback in production (e.g. https://your-app.vercel.app/api/auth/google/callback), not localhost.",
        path: ["GOOGLE_CALLBACK_URL"],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
