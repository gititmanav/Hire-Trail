import { z } from "zod";
import dotenv from "dotenv";

// Load `.env.local` FIRST (gitignored, machine-local overrides — e.g. a local
// MONGO_URI for dev), then `.env`. dotenv never overrides an already-set var, so
// `.env.local` wins locally; on Vercel neither file exists and the platform's
// env vars are used as-is. This keeps local dev off production Atlas.
dotenv.config({ path: ".env.local" });
dotenv.config();

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
    MAINTENANCE_BYPASS_EMAIL: z.string().default(""),
    GMAIL_REDIRECT_URI: z.string().default("http://localhost:5050/api/email/callback"),
    // Outlook (Microsoft Identity Platform) — "common" tenant works for personal + work accounts.
    MICROSOFT_CLIENT_ID: z.string().default(""),
    MICROSOFT_CLIENT_SECRET: z.string().default(""),
    MICROSOFT_TENANT_ID: z.string().default("common"),
    OUTLOOK_REDIRECT_URI: z.string().default("http://localhost:5050/api/email/outlook/callback"),
    ENCRYPTION_KEY: z.string().default("0000000000000000000000000000000000000000000000000000000000000000"),
    // AI provider default keys (BYOK overrides per-user)
    ANTHROPIC_API_KEY: z.string().default(""),
    OPENAI_API_KEY: z.string().default(""),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().default(""),
    OPENROUTER_API_KEY: z.string().default(""),
    /** Vercel AI Gateway API key. When set, all model calls route through the
     *  gateway (provider/model) and BYOK keys are forwarded per-request via
     *  providerOptions.gateway.byok. When empty, the resolver falls back to the
     *  per-provider SDKs using the keys above so local dev keeps working. */
    AI_GATEWAY_API_KEY: z.string().default(""),
    /** Gotenberg HTML→PDF service base URL (Cloud Run, scale-to-zero). Empty
     *  disables the HTML resume renderer (POST /api/resumes/render-pdf). */
    GOTENBERG_URL: z.string().default(""),
    // Sentry — leave empty to disable error tracking
    SENTRY_DSN: z.string().default(""),
    SENTRY_ENVIRONMENT: z.string().default(""),
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
