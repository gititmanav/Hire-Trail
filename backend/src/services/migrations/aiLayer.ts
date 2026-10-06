/**
 * One-time migrations for the 2026-10 AI layer (Revamp.md, "AI revamp").
 *
 *   migrateAiKeys   — AIProviderConfig (user keys) and the ai_default_* system
 *                     settings (the platform key) become AiKey rows with
 *                     default routes. Ciphertext is copied as-is (same
 *                     ENCRYPTION_KEY), never decrypted. Keys for providers the
 *                     new layer doesn't speak to (Bedrock, Perplexity, Cohere)
 *                     can't move: their owners get one notification saying so.
 *                     The old `ai_enabled` switch carries over.
 *   backfillMatchScores — legacy fit checks (A–F + a 1–5 score) get the one
 *                     0–10 match score, computed the same deterministic way
 *                     new ones are, from the session's keywords and the
 *                     owner's current profile.
 *
 * Both are idempotent: a re-run finds nothing left to do.
 */
import mongoose from "mongoose";

import { AIProviderConfig } from "../../models/AIProviderConfig.js";
import { SystemSettings } from "../../models/SystemSettings.js";
import { AiKey } from "../../models/AiKey.js";
import { AiRoute, AI_DEFAULT_ROUTE } from "../../models/AiRoute.js";
import { AiSettings } from "../../models/AiSettings.js";
import { Notification } from "../../models/Notification.js";
import { TailorSession } from "../../models/TailorSession.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { decrypt } from "../../utils/encryption.js";
import { isAiProviderId } from "../ai/providerIds.js";
import { AI_PROVIDERS } from "../ai/providers.js";
import { buildResumeDocument } from "../resume/document.js";
import { computeScore } from "../resume/score.js";

export const AI_KEYS_MIGRATION = "ai-layer-keys-2026-10";
export const MATCH_SCORE_MIGRATION = "tailor-match-score-2026-10";

async function setting(key: string): Promise<unknown> {
  return (await SystemSettings.findOne({ key }).select("value").lean())?.value;
}

export async function migrateAiKeys(): Promise<Record<string, number>> {
  let userKeys = 0;
  let skipped = 0;
  let platformKey = 0;
  const unsupportedOwners = new Set<string>();

  const configs = await AIProviderConfig.find({}).sort({ createdAt: 1 }).lean();
  for (const c of configs) {
    const provider = c.provider === "gemini" ? "google" : c.provider;
    if (!isAiProviderId(provider)) {
      unsupportedOwners.add(String(c.userId));
      continue;
    }
    const exists = await AiKey.exists({ owner: "user", userId: c.userId, encryptedKey: c.encryptedKey });
    if (exists) {
      skipped++;
      continue;
    }
    const key = await AiKey.create({
      owner: "user",
      userId: c.userId,
      provider,
      name: (c.name || AI_PROVIDERS[provider].label).slice(0, 60),
      encryptedKey: c.encryptedKey,
      last4: c.last4 || "",
      freeTier: false,
      createdBy: c.userId,
    });
    userKeys++;
    // The key that was active becomes the default; otherwise the first key does.
    await AiRoute.updateOne(
      { scope: "user", userId: c.userId, feature: AI_DEFAULT_ROUTE },
      { $setOnInsert: { lane: null, keyId: key._id, modelId: null } },
      { upsert: true },
    );
    if (c.isActive) {
      await AiRoute.updateOne({ scope: "user", userId: c.userId, feature: AI_DEFAULT_ROUTE }, { $set: { keyId: key._id } });
    }
  }

  for (const userId of unsupportedOwners) {
    const hasSupported = await AiKey.exists({ owner: "user", userId });
    await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      type: "info",
      title: "One of your AI keys needs replacing",
      message: hasSupported
        ? "HireTrail's AI now talks to providers directly. A key you added (Bedrock, Perplexity or Cohere) isn't supported any more; your other keys moved over. Review them in Settings → AI."
        : "HireTrail's AI now talks to providers directly, and the key you added (Bedrock, Perplexity or Cohere) isn't supported any more. Add a Google, Anthropic, OpenAI, xAI, DeepSeek, Mistral, Groq or OpenRouter key in Settings → AI — or keep using HireTrail's included AI.",
    });
  }

  // The platform default key.
  const encrypted = String((await setting("ai_default_key_encrypted")) ?? "");
  const provider = String((await setting("ai_default_provider")) ?? "");
  if (encrypted && isAiProviderId(provider) && !(await AiKey.exists({ owner: "platform", encryptedKey: encrypted }))) {
    const key = await AiKey.create({
      owner: "platform",
      userId: null,
      provider,
      name: `HireTrail ${AI_PROVIDERS[provider].label}`,
      encryptedKey: encrypted,
      last4: (() => {
        try {
          return decrypt(encrypted).trim().slice(-4);
        } catch {
          return ""; // a rotated ENCRYPTION_KEY: the key shows as unreadable on the map
        }
      })(),
      freeTier: false,
      createdBy: null,
    });
    await AiRoute.updateOne(
      { scope: "platform", userId: null, feature: AI_DEFAULT_ROUTE },
      { $setOnInsert: { lane: null, keyId: key._id, modelId: null } },
      { upsert: true },
    );
    platformKey = 1;
  }

  // The master switch.
  const enabled = await setting("ai_enabled");
  if (typeof enabled === "boolean") {
    await AiSettings.updateOne({ _id: "global" }, { $setOnInsert: { aiEnabled: enabled } }, { upsert: true });
  }

  return { userKeys, skipped, unsupportedOwners: unsupportedOwners.size, platformKey };
}

export async function backfillMatchScores(): Promise<Record<string, number>> {
  let scored = 0;
  const owners = await TailorSession.distinct("userId", { status: "succeeded", matchScore: null });
  for (const userId of owners) {
    const profile = await MasterProfile.findOne({ userId });
    if (!profile) continue;
    const doc = buildResumeDocument(profile);
    const sessions = await TailorSession.find({ userId, status: "succeeded", matchScore: null })
      .select("_id jdKeywords matchedSkills missingSkills")
      .lean();
    const ops = sessions.map((s) => {
      const kws = s.jdKeywords?.length ? s.jdKeywords : [...(s.matchedSkills ?? []), ...(s.missingSkills ?? [])];
      return { updateOne: { filter: { _id: s._id }, update: { $set: { matchScore: computeScore(doc, kws) } } } };
    });
    for (let i = 0; i < ops.length; i += 500) await TailorSession.bulkWrite(ops.slice(i, i + 500));
    scored += ops.length;
  }
  return { scored };
}
