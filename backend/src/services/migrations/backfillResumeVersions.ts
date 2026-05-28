/**
 * One-time backfill: every resume that pre-dates the versions[] feature has
 * `versions: []`, so the "edit history" strip is hidden in the UI. Push a
 * single "Imported" entry on `uploadDate` so historical resumes have *some*
 * timeline to anchor future edits against.
 *
 * Idempotent: only writes when `versions` is empty. Safe to run on every boot,
 * but the server only calls it once and logs the result.
 */
import { Resume } from "../../models/Resume.js";

export async function backfillResumeVersions(): Promise<{ updated: number }> {
  const cursor = Resume.find({
    $or: [{ versions: { $exists: false } }, { versions: { $size: 0 } }],
  }).cursor();

  let updated = 0;
  for await (const r of cursor) {
    const timestamp = r.uploadDate ?? r.createdAt ?? new Date();
    r.versions = [{ timestamp, summary: "Imported" }];
    await r.save();
    updated++;
  }
  return { updated };
}
