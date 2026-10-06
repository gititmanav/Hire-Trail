/**
 * The AI map — where each feature runs, for a person (My AI) or for the
 * platform (Admin → AI). One builder per side, one feature shape, so both
 * webs draw from the same contract.
 *
 * Reading is cheap: one query per collection, models from the per-key cache
 * (or the provider's curated default) — never a live provider call.
 */
import mongoose from "mongoose";

import { AiKey, type IAiKey } from "../../models/AiKey.js";
import { AiRoute, AI_DEFAULT_ROUTE, type IAiRoute } from "../../models/AiRoute.js";
import { AiUsage } from "../../models/AiUsage.js";
import { McpToken } from "../../models/McpToken.js";
import { AI_FEATURES, aiFeature, isAiFeatureId, publicFeatures, type AiFeatureDef } from "./registry.js";
import { getAiSettings, type AiPolicy } from "./settings.js";
import { decideLane, ensureDefaultRoute, type LaneLock } from "./routing.js";
import { AI_PROVIDERS, publicProviders } from "./providers.js";
import { cachedModels, pickDefaultModel } from "./models.js";
import { keyView, type AiKeyView } from "./keys.js";
import { aiErrorMessage, AiError, type AiErrorCode } from "./errors.js";
import { userUsage, featureOf, type UsageSummary } from "./ledger.js";
import type { AiLane, AiProviderId } from "./providerIds.js";
import type { AiUser } from "./gateway.js";
import { AppError } from "../../errors/AppError.js";

const WEEK_MS = 7 * 86_400_000;

export interface MapActivity {
  calls7d: number;
  failures7d: number;
  lastAt: string | null;
}

type PublicFeature = ReturnType<typeof publicFeatures>[number];

export interface MapFeature extends PublicFeature {
  lane: AiLane | null;
  choosable: AiLane[];
  lock: LaneLock;
  refusal: { code: AiErrorCode; message: string } | null;
  /** The person moved it themselves (Back to default undoes that). */
  userChoice: boolean;
  /** The key this feature runs on (for its lane), and whether it's pinned. */
  keyId: string | null;
  pinnedKey: boolean;
  model: string | null;
  pinnedModel: boolean;
  provider: AiProviderId | null;
  providerLabel: string | null;
  activity: MapActivity;
}

function modelOn(key: IAiKey | null, feature: AiFeatureDef, pinned: string | null): string | null {
  if (!key) return null;
  return pinned || pickDefaultModel(key.provider, feature.tier, cachedModels(key._id.toString()));
}

async function activityByFeature(match: Record<string, unknown>): Promise<Map<string, MapActivity>> {
  const since = new Date(Date.now() - WEEK_MS);
  const rows = await AiUsage.find({ ...match, createdAt: { $gte: since }, status: { $ne: "refused" } })
    .select("feature opType ok createdAt")
    .lean();
  const out = new Map<string, MapActivity>();
  for (const r of rows) {
    const f = featureOf(r);
    const a = out.get(f) ?? { calls7d: 0, failures7d: 0, lastAt: null };
    a.calls7d += 1;
    if (r.ok === false) a.failures7d += 1;
    const at = (r as { createdAt?: Date }).createdAt?.toISOString() ?? null;
    if (at && (!a.lastAt || at > a.lastAt)) a.lastAt = at;
    out.set(f, a);
  }
  return out;
}

const NO_ACTIVITY: MapActivity = { calls7d: 0, failures7d: 0, lastAt: null };

function policyView(policy: AiPolicy) {
  return {
    aiEnabled: policy.aiEnabled,
    pauseMessage: policy.pauseMessage,
    userMapEnabled: policy.userMapEnabled,
    lanes: policy.lanes,
    freeTierKeysForEmail: policy.freeTierKeysForEmail,
    /** Assistant connections (MCP) allowed at all. */
    mcpEnabled: policy.mcp.enabled,
  };
}

/* ---------------- My AI ---------------- */

export interface UserAiMap {
  policy: ReturnType<typeof policyView>;
  providers: ReturnType<typeof publicProviders>;
  keys: AiKeyView[];
  defaultKeyId: string | null;
  included: { available: boolean; provider: AiProviderId | null; providerLabel: string | null };
  assistant: { connected: boolean; lastUsedAt: string | null; client: string | null };
  features: MapFeature[];
  usage: UsageSummary;
}

export async function userAiMap(user: AiUser): Promise<UserAiMap> {
  const policy = await getAiSettings();
  const [keyRows, routes, platformRoutes, platformKeys, token, activity, usage] = await Promise.all([
    AiKey.find({ owner: "user", userId: user._id }).sort({ createdAt: 1 }),
    AiRoute.find({ scope: "user", userId: user._id }).lean(),
    AiRoute.find({ scope: "platform" }).lean(),
    AiKey.find({ owner: "platform" }).sort({ createdAt: 1 }),
    McpToken.findOne({ userId: user._id, revokedAt: null }).sort({ lastUsedAt: -1 }).lean(),
    activityByFeature({ userId: user._id }),
    userUsage(user._id, policy, user.aiOverride?.allowanceUsd ?? null),
  ]);
  const keysById = new Map(keyRows.map((k) => [k._id.toString(), k]));
  const platformById = new Map(platformKeys.map((k) => [k._id.toString(), k]));
  const userDefault = routes.find((r) => r.feature === AI_DEFAULT_ROUTE) ?? null;
  const defaultKey = (userDefault?.keyId && keysById.get(userDefault.keyId.toString())) || keyRows[0] || null;
  const platDefault = platformRoutes.find((r) => r.feature === AI_DEFAULT_ROUTE) ?? null;
  const platDefaultKey = platDefault?.keyId ? platformById.get(platDefault.keyId.toString()) ?? null : null;

  const features: MapFeature[] = AI_FEATURES.map((def) => {
    const route = routes.find((r) => r.feature === def.id) ?? null;
    const decision = decideLane(user, def, policy, route);
    let key: IAiKey | null = null;
    let pinnedKey = false;
    let pinnedModel: string | null = null;
    if (decision.lane === "byok") {
      const pinned = route?.keyId ? keysById.get(route.keyId.toString()) ?? null : null;
      key = pinned ?? defaultKey;
      pinnedKey = Boolean(pinned);
      pinnedModel = pinned ? route?.modelId ?? null : null;
    } else if (decision.lane === "included") {
      const plat = platformRoutes.find((r) => r.feature === def.id && r.keyId);
      const platKey = plat?.keyId ? platformById.get(plat.keyId.toString()) ?? null : null;
      key = platKey ?? platDefaultKey;
      pinnedModel = platKey ? plat?.modelId ?? null : null;
    }
    const model = modelOn(key, def, pinnedModel);
    return {
      ...publicFeatures().find((f) => f.id === def.id)!,
      // The admin's default, not the registry's — "Back to the default" names it.
      defaultLane: policy.features[def.id].defaultLane,
      lane: decision.lane,
      choosable: decision.choosable,
      lock: decision.lock,
      userChoice: Boolean(route),
      refusal: decision.refusal
        ? { code: decision.refusal.code, message: aiErrorMessage(decision.refusal.code, { featureLabel: def.label, custom: decision.refusal.custom, pauseMessage: policy.pauseMessage }) }
        : null,
      keyId: decision.lane === "byok" ? key?._id.toString() ?? null : null,
      pinnedKey,
      model,
      pinnedModel: Boolean(pinnedModel),
      provider: key?.provider ?? null,
      providerLabel: key ? AI_PROVIDERS[key.provider].label : null,
      activity: activity.get(def.id) ?? NO_ACTIVITY,
    };
  });

  return {
    policy: policyView(policy),
    providers: publicProviders(),
    keys: keyRows.map((k) => keyView(k)),
    defaultKeyId: defaultKey?._id.toString() ?? null,
    included: {
      available: policy.lanes.included && Boolean(platDefaultKey || platformRoutes.some((r) => r.keyId && platformById.has(r.keyId.toString()))),
      provider: platDefaultKey?.provider ?? null,
      providerLabel: platDefaultKey ? AI_PROVIDERS[platDefaultKey.provider].label : null,
    },
    assistant: {
      connected: Boolean(token),
      lastUsedAt: token?.lastUsedAt?.toISOString() ?? null,
      client: token?.lastClient || null,
    },
    features,
    usage,
  };
}

/**
 * Move a feature on the user's map: to a lane, and for My key to a key (null
 * = the default key) with an optional pinned model. Refused, in words, when
 * the admin has locked it or the lane isn't available for this feature.
 */
export async function setUserFeatureRoute(
  user: AiUser,
  featureId: string,
  patch: { lane: AiLane; keyId?: string | null; model?: string | null },
): Promise<void> {
  if (!isAiFeatureId(featureId)) throw new AppError("Unknown AI feature.", 404);
  const def = aiFeature(featureId);
  const policy = await getAiSettings();
  const current = await AiRoute.findOne({ scope: "user", userId: user._id, feature: featureId }).lean();
  const decision = decideLane(user, def, policy, current);
  if (decision.lock) {
    const why = decision.lock === "map_off"
      ? "HireTrail sets where AI runs right now, so this can't be changed."
      : decision.lock === "admin_user"
        ? "Your account's AI is set by HireTrail, so this can't be changed."
        : `${def.label} is set by HireTrail, so it can't be moved.`;
    throw new AiError("not_allowed", { feature: featureId, custom: why });
  }
  if (!decision.choosable.includes(patch.lane)) {
    throw new AiError("not_allowed", { feature: featureId, custom: `${def.label} can't run there.` });
  }
  let keyId: mongoose.Types.ObjectId | null = null;
  let model: string | null = null;
  if (patch.lane === "byok") {
    if (patch.keyId) {
      const key = mongoose.isValidObjectId(patch.keyId) ? await AiKey.findOne({ _id: patch.keyId, owner: "user", userId: user._id }) : null;
      if (!key) throw new AppError("That key isn't one of yours.", 404);
      if (key.freeTier && def.dataClass === "email" && !policy.freeTierKeysForEmail) {
        throw new AiError("not_allowed", {
          feature: featureId,
          custom: "That key is on Google's free tier, where Google may use what it receives. Email never goes there — pick a paid key for inbox sorting.",
        });
      }
      keyId = key._id;
      model = patch.model?.trim() ? patch.model.trim().slice(0, 160) : null;
    } else if (!(await AiKey.exists({ owner: "user", userId: user._id }))) {
      throw new AiError("needs_key", { lane: "byok", feature: featureId, featureLabel: def.label });
    }
  }
  await AiRoute.updateOne(
    { scope: "user", userId: user._id, feature: featureId },
    { $set: { lane: patch.lane, keyId, modelId: model, updatedBy: user._id } },
    { upsert: true },
  );
}

export async function resetUserFeatureRoute(user: AiUser, featureId: string): Promise<void> {
  if (!isAiFeatureId(featureId)) throw new AppError("Unknown AI feature.", 404);
  await AiRoute.deleteOne({ scope: "user", userId: user._id, feature: featureId });
}

export async function setUserDefaultKey(user: AiUser, keyId: string): Promise<void> {
  const key = mongoose.isValidObjectId(keyId) ? await AiKey.findOne({ _id: keyId, owner: "user", userId: user._id }) : null;
  if (!key) throw new AppError("That key isn't one of yours.", 404);
  await ensureDefaultRoute("user", user._id, key._id);
  await AiRoute.updateOne({ scope: "user", userId: user._id, feature: AI_DEFAULT_ROUTE }, { $set: { keyId: key._id, modelId: null } });
}

/* ---------------- Admin ---------------- */

export interface AdminAiMap {
  policy: AiPolicy;
  providers: ReturnType<typeof publicProviders>;
  keys: AiKeyView[];
  defaultKeyId: string | null;
  defaultModel: string | null;
  features: (PublicFeature & {
    rule: AiPolicy["features"][string];
    keyId: string | null;
    pinnedKey: boolean;
    model: string | null;
    pinnedModel: boolean;
    provider: AiProviderId | null;
    providerLabel: string | null;
    activity: MapActivity;
    /** Included calls across everyone this period, by lane. */
    lanes7d: Record<string, number>;
  })[];
}

export async function adminAiMap(): Promise<AdminAiMap> {
  const policy = await getAiSettings();
  const since = new Date(Date.now() - WEEK_MS);
  const [keys, routes, activity, laneRows] = await Promise.all([
    AiKey.find({ owner: "platform" }).sort({ createdAt: 1 }),
    AiRoute.find({ scope: "platform" }).lean() as unknown as Promise<IAiRoute[]>,
    activityByFeature({ lane: "included" }),
    AiUsage.aggregate<{ _id: { feature: string; lane: string }; n: number }>([
      { $match: { createdAt: { $gte: since }, status: { $ne: "refused" }, feature: { $ne: null } } },
      { $group: { _id: { feature: "$feature", lane: "$lane" }, n: { $sum: 1 } } },
    ]),
  ]);
  const byId = new Map(keys.map((k) => [k._id.toString(), k]));
  const def = routes.find((r) => r.feature === AI_DEFAULT_ROUTE) ?? null;
  const defaultKey = def?.keyId ? byId.get(def.keyId.toString()) ?? null : null;

  return {
    policy,
    providers: publicProviders(),
    keys: keys.map((k) => keyView(k)),
    defaultKeyId: defaultKey?._id.toString() ?? null,
    defaultModel: def?.modelId ?? null,
    features: AI_FEATURES.map((f) => {
      const route = routes.find((r) => r.feature === f.id && r.keyId) ?? null;
      const pinned = route?.keyId ? byId.get(route.keyId.toString()) ?? null : null;
      const key = pinned ?? defaultKey;
      const pinnedModel = pinned ? route?.modelId ?? null : null;
      const lanes7d: Record<string, number> = {};
      for (const r of laneRows) if (r._id.feature === f.id && r._id.lane) lanes7d[r._id.lane] = r.n;
      return {
        ...publicFeatures().find((p) => p.id === f.id)!,
        rule: policy.features[f.id],
        keyId: key?._id.toString() ?? null,
        pinnedKey: Boolean(pinned),
        model: modelOn(key, f, pinnedModel),
        pinnedModel: Boolean(pinnedModel),
        provider: key?.provider ?? null,
        providerLabel: key ? AI_PROVIDERS[key.provider].label : null,
        activity: activity.get(f.id) ?? NO_ACTIVITY,
        lanes7d,
      };
    }),
  };
}

/** Point a feature (or "default") at a platform key, optionally pinning a model.
 *  `keyId: null` on a feature removes its pin (it borrows the default again). */
export async function setPlatformRoute(
  featureId: string,
  patch: { keyId: string | null; model?: string | null },
  adminId: mongoose.Types.ObjectId,
): Promise<void> {
  const isDefault = featureId === AI_DEFAULT_ROUTE;
  if (!isDefault && !isAiFeatureId(featureId)) throw new AppError("Unknown AI feature.", 404);
  if (!patch.keyId) {
    if (isDefault) throw new AppError("Choose a key for the default route.", 400);
    await AiRoute.deleteOne({ scope: "platform", userId: null, feature: featureId });
    return;
  }
  const key = mongoose.isValidObjectId(patch.keyId) ? await AiKey.findOne({ _id: patch.keyId, owner: "platform" }) : null;
  if (!key) throw new AppError("No such platform key.", 404);
  await AiRoute.updateOne(
    { scope: "platform", userId: null, feature: featureId },
    { $set: { lane: null, keyId: key._id, modelId: patch.model?.trim() ? patch.model.trim().slice(0, 160) : null, updatedBy: adminId } },
    { upsert: true },
  );
}
