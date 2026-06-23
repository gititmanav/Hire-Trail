/**
 * One-time, idempotent migrations for the AI platform rollout.
 *
 *   1. seedAiSettings           — insert the new ai_* SystemSettings rows on
 *                                 databases that were seeded before they existed.
 *   2. migrateAiProviderConfigs — backfill `last4` from the encrypted key, and
 *                                 collapse to a single active key per user (the
 *                                 platform now enforces exactly one active key).
 *
 * Safe to run on every boot — each step only writes when something is missing.
 */
import { AIProviderConfig } from "../../models/AIProviderConfig.js";
import { SystemSettings, DEFAULT_SETTINGS } from "../../models/SystemSettings.js";
import { decrypt } from "../../utils/encryption.js";

export async function seedAiSettings(): Promise<{ created: number }> {
  const aiDefaults = DEFAULT_SETTINGS.filter((s) => s.category === "ai");
  let created = 0;
  for (const s of aiDefaults) {
    const r = await SystemSettings.updateOne(
      { key: s.key },
      { $setOnInsert: { ...s, updatedBy: null } },
      { upsert: true },
    );
    if (r.upsertedCount && r.upsertedCount > 0) created++;
  }
  return { created };
}

export async function migrateAiProviderConfigs(): Promise<{ last4Filled: number; deactivated: number }> {
  // 1. Backfill last4 for keys created before the field existed.
  let last4Filled = 0;
  const missing = await AIProviderConfig.find({ $or: [{ last4: { $exists: false } }, { last4: "" }] });
  for (const k of missing) {
    try {
      k.last4 = decrypt(k.encryptedKey).slice(-4);
      await k.save();
      last4Filled++;
    } catch {
      // Undecryptable (rotated ENCRYPTION_KEY) — leave blank.
    }
  }

  // 2. Enforce one active key per user: keep the most-recently-created active
  //    key, deactivate the rest. Previously we allowed one active PER PROVIDER.
  let deactivated = 0;
  const dupes = await AIProviderConfig.aggregate<{ _id: unknown; count: number }>([
    { $match: { isActive: true } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  for (const u of dupes) {
    const keys = await AIProviderConfig.find({ userId: u._id, isActive: true }).sort({ createdAt: -1 });
    const keep = keys[0]?._id;
    const r = await AIProviderConfig.updateMany(
      { userId: u._id, isActive: true, _id: { $ne: keep } },
      { $set: { isActive: false } },
    );
    deactivated += r.modifiedCount ?? 0;
  }

  return { last4Filled, deactivated };
}
