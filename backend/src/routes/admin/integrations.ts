import { Router, Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import mongoose from "mongoose";
import { User } from "../../models/User.js";

const router = Router();

interface IntegrationInfo {
  name: string;
  key: string;
  status: "connected" | "disconnected" | "error";
  details?: string;
  category: string;
}

/**
 * Dynamically detect integrations from environment variables.
 * Add new integrations here — they'll auto-appear in the UI.
 */
function getIntegrationDefinitions(): Array<{
  name: string;
  key: string;
  category: string;
  envKeys: string[];
  testFn?: () => Promise<{ status: "connected" | "error"; details?: string }>;
}> {
  return [
    {
      name: "MongoDB",
      key: "mongodb",
      category: "Database",
      envKeys: ["MONGO_URI"],
      testFn: async () => {
        const state = mongoose.connection.readyState;
        if (state === 1) return { status: "connected", details: "Connected to Atlas" };
        return { status: "error", details: `Connection state: ${state}` };
      },
    },
    {
      name: "Cloudinary",
      key: "cloudinary",
      category: "Storage",
      envKeys: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
      testFn: async () => {
        try {
          const { v2: cloudinary } = await import("cloudinary");
          await cloudinary.api.ping();
          return { status: "connected" };
        } catch {
          return { status: "error", details: "Ping failed" };
        }
      },
    },
    {
      name: "Google OAuth 2.0",
      key: "google_oauth",
      category: "Authentication",
      envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    },
    {
      name: "JSearch API (RapidAPI)",
      key: "jsearch",
      category: "Job Search",
      envKeys: ["JSEARCH_API_KEY"],
    },
    {
      name: "Gmail API",
      key: "gmail_api",
      category: "Email Integration",
      envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REDIRECT_URI", "ENCRYPTION_KEY"],
      testFn: async () => {
        const count = await User.countDocuments({ gmailConnected: true });
        return { status: "connected", details: `${count} user(s) connected` };
      },
    },
  ];
}

/** GET / — dynamic integration status */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const definitions = getIntegrationDefinitions();
    const integrations: IntegrationInfo[] = [];

    for (const def of definitions) {
      // Check if all required env vars are set
      const allConfigured = def.envKeys.every((k) => {
        const val = (env as Record<string, unknown>)[k];
        return val !== undefined && val !== null && val !== "";
      });

      if (!allConfigured) {
        integrations.push({
          name: def.name,
          key: def.key,
          status: "disconnected",
          details: `Missing env: ${def.envKeys.filter((k) => !(env as Record<string, unknown>)[k]).join(", ")}`,
          category: def.category,
        });
        continue;
      }

      // If there's a test function, run it
      if (def.testFn) {
        try {
          const result = await def.testFn();
          integrations.push({
            name: def.name,
            key: def.key,
            status: result.status,
            details: result.details,
            category: def.category,
          });
        } catch {
          integrations.push({
            name: def.name,
            key: def.key,
            status: "error",
            details: "Test failed",
            category: def.category,
          });
        }
      } else {
        integrations.push({
          name: def.name,
          key: def.key,
          status: "connected",
          details: "Configured",
          category: def.category,
        });
      }
    }

    res.json({ integrations });
  } catch (err) {
    next(err);
  }
});

export default router;
