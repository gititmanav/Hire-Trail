import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("Connected to MongoDB Atlas via Mongoose");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
