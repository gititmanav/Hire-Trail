import { z } from "zod";
import "dotenv/config";
const envSchema = z.object({
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
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const env = parsed.data;
//# sourceMappingURL=env.js.map