/**
 * Where a feature runs for one user — the lane, then the key and the model.
 *
 * Lane, in order of authority:
 *   1. AI off platform-wide, or the feature switched off → refused (disabled)
 *   2. the user is suspended from AI (admin override) → refused (not_allowed)
 *   3. the admin's per-user forced lane, if the feature allows it
 *   4. the admin's forced lane for the feature
 *   5. the user's own choice for the feature (only while the user map is on)
 *   6. the feature's default lane
 * A choice that isn't allowed (or whose lane is switched off platform-wide)
 * falls to the next allowed lane, so a stale user route can never strand a
 * feature.
 *
 * Key and model:
 *   included → the platform route for the feature, else the platform default
 *              route (which lends its KEY; the feature keeps its own curated
 *              model for that provider — Sora's asymmetry)
 *   byok     → the user's route for the feature, else the user's default key;
 *              a pinned model, else the feature's default on that provider
 */
import mongoose from "mongoose";

import { AiKey, type IAiKey } from "../../models/AiKey.js";
import { AiRoute, AI_DEFAULT_ROUTE, type IAiRoute } from "../../models/AiRoute.js";
import type { IUser } from "../../models/User.js";
import { aiFeature, type AiFeatureDef, type AiTier } from "./registry.js";
import { getAiSettings, laneGloballyOn, type AiPolicy } from "./settings.js";
import type { AiLane, AiProviderId } from "./providerIds.js";
import type { AiErrorCode } from "./errors.js";
import { cachedModels, listModelsForKey, pickDefaultModel } from "./models.js";
import { decryptKey } from "./keys.js";

const DEMO_EMAIL = "demo@hiretrail.com";
const LANE_ORDER: AiLane[] = ["included", "byok", "assistant", "off"];

export type LaneLock = "admin_feature" | "admin_user" | "map_off" | null;

export interface LaneDecision {
  lane: AiLane | null;
  /** Lanes this user may pick for this feature right now. */
  choosable: AiLane[];
  /** Why the user can't change it, when they can't. */
  lock: LaneLock;
  refusal: { code: AiErrorCode; custom?: string } | null;
}

type UserLike = Pick<IUser, "_id" | "email"> & { aiOverride?: IUser["aiOverride"] };

/** The lane only — no keys touched. Shared by the gateway and the maps. */
export function decideLane(
  user: UserLike,
  feature: AiFeatureDef,
  policy: AiPolicy,
  userRoute: Pick<IAiRoute, "lane"> | null,
): LaneDecision {
  const rule = policy.features[feature.id];
  const choosable = rule.allowedLanes.filter((l) => laneGloballyOn(policy, l));
  if (!policy.aiEnabled) {
    return { lane: null, choosable: [], lock: "admin_feature", refusal: { code: "disabled", custom: policy.pauseMessage || "AI is paused on HireTrail right now." } };
  }
  if (!rule.enabled) return { lane: null, choosable: [], lock: "admin_feature", refusal: { code: "disabled" } };
  if (user.email === DEMO_EMAIL) {
    return { lane: null, choosable: [], lock: "admin_user", refusal: { code: "not_allowed", custom: "AI isn't available on the demo account. Create a free account to use it." } };
  }
  if (user.aiOverride?.suspended) return { lane: null, choosable: [], lock: "admin_user", refusal: { code: "not_allowed" } };

  const usable = (l: AiLane | null | undefined): l is AiLane => !!l && choosable.includes(l);
  const userForced = user.aiOverride?.forcedLane;
  if (usable(userForced)) return { lane: userForced, choosable: [userForced], lock: "admin_user", refusal: null };
  if (usable(rule.forcedLane)) return { lane: rule.forcedLane, choosable: [rule.forcedLane], lock: "admin_feature", refusal: null };
  if (rule.forcedLane && !usable(rule.forcedLane)) {
    // Forced onto a lane that's switched off platform-wide — refuse plainly
    // rather than silently running somewhere the admin didn't intend.
    return { lane: null, choosable: [], lock: "admin_feature", refusal: { code: "disabled" } };
  }
  const mapOff = !policy.userMapEnabled;
  if (!mapOff && usable(userRoute?.lane)) return { lane: userRoute!.lane!, choosable, lock: null, refusal: null };
  const fallback = [rule.defaultLane, ...LANE_ORDER].find((l) => usable(l));
  if (!fallback) return { lane: null, choosable, lock: mapOff ? "map_off" : null, refusal: { code: "disabled" } };
  return { lane: fallback, choosable: mapOff ? [] : choosable, lock: mapOff ? "map_off" : null, refusal: null };
}

export type Resolution =
  | {
      kind: "run";
      lane: "included" | "byok";
      key: IAiKey;
      secret: string;
      provider: AiProviderId;
      model: string;
      /** "feature" = its own route, "default" = borrowed the default key, "auto" = no route, picked for you. */
      via: "feature" | "default" | "auto";
      policy: AiPolicy;
    }
  | { kind: "assistant"; policy: AiPolicy }
  | { kind: "refuse"; code: AiErrorCode; lane?: AiLane; custom?: string; policy: AiPolicy };

async function modelFor(key: IAiKey, feature: AiFeatureDef, pinned: string | null, tier?: AiTier): Promise<string> {
  if (pinned) return pinned;
  let live = cachedModels(key._id.toString());
  if (!live) {
    try {
      live = await listModelsForKey(key._id.toString(), key.provider, decryptKey(key));
    } catch {
      live = null; // the call itself will report a dead key in plain words
    }
  }
  return pickDefaultModel(key.provider, tier ?? feature.tier, live);
}

/** The lane a feature would run in for this user — no keys touched. Used to
 *  skip automatic work (on track, on upload) when a feature is off or refused. */
export async function laneFor(user: UserLike, featureId: string): Promise<LaneDecision> {
  const feature = aiFeature(featureId);
  const [policy, route] = await Promise.all([
    getAiSettings(),
    AiRoute.findOne({ scope: "user", userId: user._id, feature: featureId }).select("lane").lean(),
  ]);
  return decideLane(user, feature, policy, route as Pick<IAiRoute, "lane"> | null);
}

export async function userRoutes(userId: mongoose.Types.ObjectId): Promise<IAiRoute[]> {
  return AiRoute.find({ scope: "user", userId }).lean() as unknown as Promise<IAiRoute[]>;
}

export async function platformRoutes(): Promise<IAiRoute[]> {
  return AiRoute.find({ scope: "platform" }).lean() as unknown as Promise<IAiRoute[]>;
}

/** `tier` asks for the provider's stronger (or faster) default for one call —
 *  a pinned model always wins. */
export async function resolveRoute(user: UserLike, featureId: string, opts: { tier?: AiTier } = {}): Promise<Resolution> {
  const feature = aiFeature(featureId);
  const policy = await getAiSettings();
  const routes = await AiRoute.find({
    $or: [
      { scope: "user", userId: user._id, feature: { $in: [featureId, AI_DEFAULT_ROUTE] } },
      { scope: "platform", feature: { $in: [featureId, AI_DEFAULT_ROUTE] } },
    ],
  }).lean();
  const userFeature = routes.find((r) => r.scope === "user" && r.feature === featureId) ?? null;
  const userDefault = routes.find((r) => r.scope === "user" && r.feature === AI_DEFAULT_ROUTE) ?? null;
  const platFeature = routes.find((r) => r.scope === "platform" && r.feature === featureId) ?? null;
  const platDefault = routes.find((r) => r.scope === "platform" && r.feature === AI_DEFAULT_ROUTE) ?? null;

  const decision = decideLane(user, feature, policy, userFeature);
  if (decision.refusal || !decision.lane) {
    return { kind: "refuse", code: decision.refusal?.code ?? "disabled", custom: decision.refusal?.custom, policy };
  }
  const lane = decision.lane;
  if (lane === "off") return { kind: "refuse", code: "off", lane, policy };
  if (lane === "assistant") return { kind: "assistant", policy };

  if (lane === "included") {
    const route = platFeature?.keyId ? platFeature : platDefault?.keyId ? platDefault : null;
    const key = route?.keyId ? await AiKey.findOne({ _id: route.keyId, owner: "platform" }) : null;
    if (!route || !key) return { kind: "refuse", code: "no_route", lane, policy };
    const via = route === platFeature ? "feature" : "default";
    // The default lends its key, never its model.
    const model = await modelFor(key, feature, via === "feature" ? route.modelId : null, opts.tier);
    return { kind: "run", lane, key, secret: decryptKey(key), provider: key.provider, model, via, policy };
  }

  // byok
  const route = userFeature?.keyId ? userFeature : userDefault?.keyId ? userDefault : null;
  let key = route?.keyId ? await AiKey.findOne({ _id: route.keyId, owner: "user", userId: user._id }) : null;
  let via: "feature" | "default" | "auto" = route === userFeature ? "feature" : "default";
  if (!key) {
    key = await AiKey.findOne({ owner: "user", userId: user._id }).sort({ createdAt: 1 });
    via = "auto";
  }
  if (!key) return { kind: "refuse", code: "needs_key", lane, policy };
  if (key.freeTier && feature.dataClass === "email" && !policy.freeTierKeysForEmail) {
    return {
      kind: "refuse",
      code: "not_allowed",
      lane,
      custom: `Your ${key.name} key is on Google's free tier, where Google may use what it receives. HireTrail never sends your email there — use a paid key for inbox sorting, or switch it back to Included in Settings → AI.`,
      policy,
    };
  }
  const model = await modelFor(key, feature, via === "feature" ? route?.modelId ?? null : null, opts.tier);
  return { kind: "run", lane, key, secret: decryptKey(key), provider: key.provider, model, via, policy };
}

/** First key of an owner becomes its default route (insert-or-nothing), so a
 *  feature works the moment a key exists. An existing choice is never overwritten. */
export async function ensureDefaultRoute(scope: "platform" | "user", userId: mongoose.Types.ObjectId | null, keyId: mongoose.Types.ObjectId): Promise<void> {
  await AiRoute.updateOne(
    { scope, userId: scope === "user" ? userId : null, feature: AI_DEFAULT_ROUTE },
    { $setOnInsert: { lane: null, keyId, modelId: null } },
    { upsert: true },
  );
  // A default whose key was deleted is re-pointed at the new key.
  await AiRoute.updateOne(
    { scope, userId: scope === "user" ? userId : null, feature: AI_DEFAULT_ROUTE, keyId: null },
    { $set: { keyId } },
  );
}
