/** Runs one-time data migrations at most once per database.
 *
 *  They used to run on every cold start — idempotent, but each one still
 *  scanned its collection, and on serverless every cold start is a boot. Now
 *  boot does one indexed read of the `migrations` ledger and runs only what
 *  isn't recorded there. A migration is recorded after it succeeds, so a
 *  failure simply retries next boot; two instances booting together may both
 *  run a pending one, which is safe because every migration is idempotent.
 *
 *  Adding a migration: give it a new, permanent name. Never rename one that
 *  has shipped (it would run again). */
import { Migration } from "../../models/Migration.js";

export interface BootMigration {
  name: string;
  run: () => Promise<Record<string, number>>;
}

export async function runBootMigrations(migrations: BootMigration[]): Promise<void> {
  const applied = await Migration.find({ _id: { $in: migrations.map((m) => m.name) } }).select("_id").lean();
  const done = new Set(applied.map((m) => m._id));
  for (const m of migrations) {
    if (done.has(m.name)) continue;
    try {
      const result = await m.run();
      await Migration.updateOne({ _id: m.name }, { $setOnInsert: { ranAt: new Date(), result } }, { upsert: true });
      console.log(`[migrate] ${m.name}: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error(`[migrate] ${m.name} failed — will retry on the next boot:`, err);
    }
  }
}
