/** Mongoose connection singleton; exits on failure so the API never runs without a DB. */
import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI, {
      // Fail fast instead of hanging: users were seeing requests stall for
      // 30-250s ("Socket 'secureConnect' timed out") while the driver retried.
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    });
    const { host, name } = mongoose.connection;
    console.log(`Connected to MongoDB via Mongoose (${host}/${name})`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
