/** Mongoose connection singleton; exits on failure so the API never runs without a DB. */
import mongoose from "mongoose";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
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
    // Vercel freezes idle function instances. A connection caught mid-flight
    // by a freeze fails on thaw ("secureConnect timed out after 551147ms") as
    // an unhandled rejection, and the runtime kills the process — taking every
    // concurrent request with it (the 2026-09-24 intermittent-500s incident).
    // attachDatabasePool releases idle pool clients before suspension; it is a
    // no-op outside Vercel.
    attachDatabasePool(mongoose.connection.getClient());
    const { host, name } = mongoose.connection;
    console.log(`Connected to MongoDB via Mongoose (${host}/${name})`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
