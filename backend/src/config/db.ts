/** Mongoose connection singleton — the API never runs without a DB.
 *
 *  Production: a failed connect exits; the host starts a fresh instance on the
 *  next request. Development: it keeps retrying (1 s, 2 s, 4 s, 8 s, then every
 *  15 s) until Mongo answers. `tsx watch` doesn't restart a process that
 *  exited — only a file change does — so one Mongo blip at startup (Docker
 *  still waking) used to leave the API down, every request a bare 500 from the
 *  Vite proxy, until someone saved a file (2026-10-08). */
import mongoose from "mongoose";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "./env.js";

const DEV_RETRY_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDB(): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, {
        // Fail fast instead of hanging: users were seeing requests stall for
        // 30-250s ("Socket 'secureConnect' timed out") while the driver retried.
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        // Serverless: close pooled connections that sit idle, so a frozen
        // instance doesn't wake up holding sockets Atlas already dropped.
        maxIdleTimeMS: 10_000,
      });
      break;
    } catch (err) {
      if (env.NODE_ENV === "production") {
        console.error("MongoDB connection error:", err);
        process.exit(1);
      }
      const wait = DEV_RETRY_MS[Math.min(attempt, DEV_RETRY_MS.length - 1)];
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`MongoDB isn't reachable (${reason}). Retrying in ${wait / 1000}s — is local Mongo up? (npm run db:up)`);
      await sleep(wait);
    }
  }
  // Vercel freezes idle function instances. A connection caught mid-flight
  // by a freeze fails on thaw ("secureConnect timed out after 551147ms") as
  // an unhandled rejection, and the runtime kills the process — taking every
  // concurrent request with it (the 2026-09-24 intermittent-500s incident).
  // attachDatabasePool releases idle pool clients before suspension; it is a
  // no-op outside Vercel.
  attachDatabasePool(mongoose.connection.getClient());
  const { host, name } = mongoose.connection;
  console.log(`Connected to MongoDB via Mongoose (${host}/${name})`);
}
