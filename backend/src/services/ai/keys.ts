/**
 * The key vault (Sora's lifecycle, HireTrail's owners).
 *
 *   addKey     — tested on save. An auth or quota failure refuses the save in
 *                the provider's words; a provider that's down or busy saves
 *                the key with a note ("couldn't check yet — checked on first use").
 *   rotateKey  — same provider only; the new secret is tested first and a dead
 *                one is refused with the stored key left untouched.
 *   checkKey   — re-tests the stored secret (the red-dot recovery loop).
 *   deleteKey  — removes the key and every route pointing at it.
 *
 * Secrets are decrypted only inside services/ai. Every response shape here is
 * `keyView` — nickname, provider, last4, health — never ciphertext.
 */
import mongoose from "mongoose";

import { AiKey, type IAiKey, type AiKeyOwner } from "../../models/AiKey.js";
import { AiRoute } from "../../models/AiRoute.js";
import { encrypt, decrypt } from "../../utils/encryption.js";
import { AppError, NotFoundError } from "../../errors/AppError.js";
import { AI_PROVIDERS, AiProviderCallError } from "./providers.js";
import type { AiProviderId } from "./providerIds.js";
import { forgetModels, listModelsForKey } from "./models.js";

export interface AiKeyView {
  id: string;
  owner: AiKeyOwner;
  provider: AiProviderId;
  providerLabel: string;
  name: string;
  last4: string;
  freeTier: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export function keyView(k: Pick<IAiKey, "_id" | "owner" | "provider" | "name" | "last4" | "freeTier" | "lastCheckedAt" | "lastError" | "createdAt">): AiKeyView {
  return {
    id: k._id.toString(),
    owner: k.owner,
    provider: k.provider,
    providerLabel: AI_PROVIDERS[k.provider]?.label ?? k.provider,
    name: k.name,
    last4: k.last4,
    freeTier: k.freeTier,
    lastCheckedAt: k.lastCheckedAt,
    lastError: k.lastError,
    createdAt: k.createdAt,
  };
}

export function decryptKey(k: Pick<IAiKey, "encryptedKey">): string {
  return decrypt(k.encryptedKey);
}

/** Who may touch a key: the platform admin for platform keys, the owner for user keys. */
export type KeyScope = { owner: "platform" } | { owner: "user"; userId: mongoose.Types.ObjectId };

function scopeFilter(scope: KeyScope): Record<string, unknown> {
  return scope.owner === "platform" ? { owner: "platform" } : { owner: "user", userId: scope.userId };
}

export async function listKeys(scope: KeyScope): Promise<AiKeyView[]> {
  const rows = await AiKey.find(scopeFilter(scope)).sort({ createdAt: 1 }).lean();
  return rows.map((r) => keyView(r as unknown as IAiKey));
}

export async function findKey(scope: KeyScope, keyId: string): Promise<IAiKey> {
  if (!mongoose.isValidObjectId(keyId)) throw new NotFoundError("AI key");
  const key = await AiKey.findOne({ _id: keyId, ...scopeFilter(scope) });
  if (!key) throw new NotFoundError("AI key");
  return key;
}

/** Live probe. `ok:false` with `refuse:true` means the key must not be saved. */
async function probe(provider: AiProviderId, secret: string): Promise<{ ok: true } | { ok: false; refuse: boolean; message: string }> {
  try {
    await AI_PROVIDERS[provider].listModels(secret);
    return { ok: true };
  } catch (err) {
    if (err instanceof AiProviderCallError) {
      if (err.code === "auth") return { ok: false, refuse: true, message: `${AI_PROVIDERS[provider].label} rejected this key — check you copied all of it.` };
      if (err.code === "quota") return { ok: false, refuse: true, message: `This ${AI_PROVIDERS[provider].label} account is out of credit. Add billing, then try again.` };
      return { ok: false, refuse: false, message: "Couldn't check this key yet — it will be checked on first use." };
    }
    return { ok: false, refuse: false, message: "Couldn't check this key yet — it will be checked on first use." };
  }
}

/** The display tail: the last four characters of the secret. */
function last4Of(secret: string): string {
  return secret.trim().slice(-4);
}

export async function addKey(
  scope: KeyScope,
  input: { provider: AiProviderId; name: string; secret: string; freeTier?: boolean },
  actorId: mongoose.Types.ObjectId,
): Promise<{ key: AiKeyView; note: string | null }> {
  const secret = input.secret.trim();
  if (secret.length < 12) throw new AppError("That key looks too short. Copy the whole key from the provider.", 400);
  const result = await probe(input.provider, secret);
  if (!result.ok && result.refuse) throw new AppError(result.message, 400, { code: "ai_key_rejected" });
  const doc = await AiKey.create({
    owner: scope.owner,
    userId: scope.owner === "user" ? scope.userId : null,
    provider: input.provider,
    name: input.name.trim().slice(0, 60) || AI_PROVIDERS[input.provider].label,
    encryptedKey: encrypt(secret),
    last4: last4Of(secret),
    freeTier: AI_PROVIDERS[input.provider].hasFreeTier ? Boolean(input.freeTier) : false,
    lastCheckedAt: result.ok ? new Date() : null,
    lastError: null,
    createdBy: actorId,
  });
  return { key: keyView(doc), note: result.ok ? null : result.message };
}

export async function updateKey(
  scope: KeyScope,
  keyId: string,
  patch: { name?: string; freeTier?: boolean; secret?: string },
): Promise<{ key: AiKeyView; note: string | null }> {
  const key = await findKey(scope, keyId);
  let note: string | null = null;
  if (patch.secret !== undefined) {
    const secret = patch.secret.trim();
    if (secret.length < 12) throw new AppError("That key looks too short. Copy the whole key from the provider.", 400);
    const result = await probe(key.provider, secret);
    if (!result.ok && result.refuse) {
      throw new AppError(`${result.message} The stored key was left untouched.`, 400, { code: "ai_key_rejected" });
    }
    key.encryptedKey = encrypt(secret);
    key.last4 = last4Of(secret);
    key.lastCheckedAt = result.ok ? new Date() : null;
    key.lastError = null;
    note = result.ok ? null : result.message;
    forgetModels(key._id.toString());
  }
  if (patch.name !== undefined) key.name = patch.name.trim().slice(0, 60) || key.name;
  if (patch.freeTier !== undefined && AI_PROVIDERS[key.provider].hasFreeTier) key.freeTier = patch.freeTier;
  await key.save();
  return { key: keyView(key), note };
}

export async function checkKey(scope: KeyScope, keyId: string): Promise<AiKeyView> {
  const key = await findKey(scope, keyId);
  forgetModels(key._id.toString());
  const result = await probe(key.provider, decryptKey(key));
  key.lastCheckedAt = new Date();
  key.lastError = result.ok ? null : result.refuse ? result.message : key.lastError;
  await key.save();
  if (!result.ok && !result.refuse) throw new AppError(result.message, 503, { code: "ai_provider_down" });
  return keyView(key);
}

/** Deleting a key removes the feature routes pinned to it (those features
 *  fall back to the default). The default route itself moves to the owner's
 *  oldest remaining key, so deleting one key never switches everything off
 *  while a healthy one exists (Sora finding F11). */
export async function deleteKey(scope: KeyScope, keyId: string): Promise<{ routesCleared: number; defaultMovedTo: string | null }> {
  const key = await findKey(scope, keyId);
  const ownerFilter = { scope: scope.owner, userId: scope.owner === "user" ? scope.userId : null };
  const routes = await AiRoute.deleteMany({ ...ownerFilter, keyId: key._id, feature: { $ne: "default" } });
  await key.deleteOne();
  forgetModels(keyId);
  const next = await AiKey.findOne(scopeFilter(scope)).sort({ createdAt: 1 });
  if (next) {
    await AiRoute.updateOne({ ...ownerFilter, feature: "default", keyId: key._id }, { $set: { keyId: next._id, modelId: null } });
  } else {
    await AiRoute.deleteMany({ ...ownerFilter, feature: "default", keyId: key._id });
  }
  return { routesCleared: routes.deletedCount ?? 0, defaultMovedTo: next ? next._id.toString() : null };
}

export async function modelsForKey(scope: KeyScope, keyId: string) {
  const key = await findKey(scope, keyId);
  try {
    return await listModelsForKey(key._id.toString(), key.provider, decryptKey(key));
  } catch (err) {
    if (err instanceof AiProviderCallError) {
      throw new AppError(
        err.code === "auth" ? `${AI_PROVIDERS[key.provider].label} rejected this key — check it before picking a model.` : "Couldn't fetch this key's models right now.",
        err.code === "auth" ? 400 : 503,
        { code: `ai_${err.code}` },
      );
    }
    throw err;
  }
}

/** Gateway hook: pin a key's health after a call (persistent problems only). */
export async function stampKeyHealth(keyId: mongoose.Types.ObjectId, error: string | null): Promise<void> {
  await AiKey.updateOne({ _id: keyId }, { $set: { lastError: error, lastCheckedAt: new Date() } });
}
