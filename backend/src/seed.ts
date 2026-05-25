/**
 * Development/demo dataset entry point.
 *
 * Run: `npm run seed` from `backend/`.
 *
 * The actual seed logic lives in `utils/seedData.ts` so the admin "Run seed"
 * route and this CLI produce identical output (companies, mock AI fit scores,
 * 2026 date window, protected demo resume, etc.). This script is a thin shell
 * around `runSeed` — connect → clear demo data → seed → disconnect.
 */
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { runSeed, clearSeedData } from "./utils/seedData.js";

async function seed(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Wipe any prior demo data so the run is reproducible. Only touches the
    // demo user's records — real users on the same DB are untouched.
    console.log("Clearing existing demo data...");
    await clearSeedData();

    console.log("Seeding demo data...");
    const result = await runSeed();
    console.log("Created demo user: demo@hiretrail.com / password123");
    console.log(`  Resumes:      ${result.resumes}`);
    console.log(`  Applications: ${result.applications}`);
    console.log(`  Contacts:     ${result.contacts}`);
    console.log(`  Deadlines:    ${result.deadlines}`);
    console.log(`  Companies:    ${result.companies}`);
    console.log(`\nTotal records seeded: ${result.total}`);
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Seed error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
