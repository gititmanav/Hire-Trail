/**
 * The admin's AI policy, read and written through one place.
 *
 * `getAiSettings()` returns a fully normalized policy: every registry feature
 * has a complete rule, filled from the registry where the stored document is
 * silent (a feature added after the document was written, or a field added
 * after the feature). A 30 s in-process cache keeps the gateway off Mongo on
 * every call; writes go through `updateAiSettings` and clear it. On
 * serverless another instance may serve the old policy for up to 30 s — an
 * accepted window for an admin toggle.
 */
import mongoose from "mongoose";

import { AiSettings, type IAiSettings, type AiFeaturePolicyDoc } from "../../models/AiSettings.js";
import { AI_FEATURES, aiFeature } from "./registry.js";
import { AI_LANES, type AiLane, isAiLane } from "./providerIds.js";

export interface AiFeaturePolicy {
  enabled: boolean;
  /** Lanes users may choose for this feature (always ⊆ the registry's lanes). */
  allowedLanes: AiLane[];
  /** When set, every user runs this feature in this lane — the user map shows it locked. */
  forcedLane: AiLane | null;
  defaultLane: AiLane;
  includedMonthlyLimit: number;
}

export interface AiPolicy {
  aiEnabled: boolean;
  pauseMessage: string;
  userMapEnabled: boolean;
  lanes: { included: boolean; byok: boolean; assistant: boolean };
  budget: { monthlyCapUsd: number; perUserAllowanceUsd: number; alertAtPct: number[] };
  freeTierKeysForEmail: boolean;
  mcp: { enabled: boolean; callsPerHour: number; writesPerHour: number; writeToolsEnabled: boolean };
  features: Record<string, AiFeaturePolicy>;
  alertsSent: string[];
  updatedAt: Date | null;
}

const CACHE_MS = 30_000;
let cache: { at: number; value: AiPolicy } | null = null;

function normalizeFeature(id: string, doc: AiFeaturePolicyDoc | undefined): AiFeaturePolicy {
  const def = aiFeature(id);
  const allowed = (doc?.allowedLanes ?? def.lanes).filter((l) => def.lanes.includes(l));
  const allowedLanes = allowed.length ? allowed : [...def.lanes];
  const forced = doc?.forcedLane && def.lanes.includes(doc.forcedLane) ? doc.forcedLane : null;
  const defaultLane = doc?.defaultLane && allowedLanes.includes(doc.defaultLane)
    ? doc.defaultLane
    : allowedLanes.includes(def.defaultLane) ? def.defaultLane : allowedLanes[0];
  return {
    enabled: doc?.enabled ?? true,
    allowedLanes,
    forcedLane: forced,
    defaultLane,
    includedMonthlyLimit: Math.max(0, Math.floor(doc?.includedMonthlyLimit ?? def.defaultIncludedMonthlyLimit)),
  };
}

function normalize(doc: (Partial<IAiSettings> & { features?: unknown }) | null): AiPolicy {
  const entries = Array.isArray(doc?.features) ? (doc!.features as AiFeaturePolicyDoc[]) : [];
  const stored = new Map(entries.map((e) => [e.feature, e]));
  const features: Record<string, AiFeaturePolicy> = {};
  for (const f of AI_FEATURES) features[f.id] = normalizeFeature(f.id, stored.get(f.id));
  return {
    aiEnabled: doc?.aiEnabled ?? true,
    pauseMessage: doc?.pauseMessage ?? "",
    userMapEnabled: doc?.userMapEnabled ?? true,
    lanes: {
      included: doc?.lanes?.included ?? true,
      byok: doc?.lanes?.byok ?? true,
      assistant: doc?.lanes?.assistant ?? true,
    },
    budget: {
      monthlyCapUsd: Math.max(0, doc?.budget?.monthlyCapUsd ?? 25),
      perUserAllowanceUsd: Math.max(0, doc?.budget?.perUserAllowanceUsd ?? 0.5),
      alertAtPct: (doc?.budget?.alertAtPct?.length ? doc.budget.alertAtPct : [50, 80, 100]).filter((n) => n > 0 && n <= 100),
    },
    freeTierKeysForEmail: doc?.freeTierKeysForEmail ?? false,
    mcp: {
      enabled: doc?.mcp?.enabled ?? true,
      callsPerHour: Math.max(1, doc?.mcp?.callsPerHour ?? 600),
      writesPerHour: Math.max(0, doc?.mcp?.writesPerHour ?? 120),
      writeToolsEnabled: doc?.mcp?.writeToolsEnabled ?? true,
    },
    features,
    alertsSent: doc?.alertsSent ?? [],
    updatedAt: doc?.updatedAt ?? null,
  };
}

export async function getAiSettings(): Promise<AiPolicy> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await AiSettings.findById("global").lean();
  const value = normalize(doc as Partial<IAiSettings> | null);
  cache = { at: Date.now(), value };
  return value;
}

export function clearAiSettingsCache(): void {
  cache = null;
}

/** Is a lane switched on platform-wide? Off is always available. */
export function laneGloballyOn(policy: AiPolicy, lane: AiLane): boolean {
  return lane === "off" ? true : policy.lanes[lane];
}

export interface AiSettingsPatch {
  aiEnabled?: boolean;
  pauseMessage?: string;
  userMapEnabled?: boolean;
  lanes?: Partial<AiPolicy["lanes"]>;
  budget?: Partial<AiPolicy["budget"]>;
  freeTierKeysForEmail?: boolean;
  mcp?: Partial<AiPolicy["mcp"]>;
}

export async function updateAiSettings(patch: AiSettingsPatch, adminId: mongoose.Types.ObjectId): Promise<AiPolicy> {
  const $set: Record<string, unknown> = { updatedBy: adminId };
  if (patch.aiEnabled !== undefined) $set.aiEnabled = patch.aiEnabled;
  if (patch.pauseMessage !== undefined) $set.pauseMessage = patch.pauseMessage.slice(0, 280);
  if (patch.userMapEnabled !== undefined) $set.userMapEnabled = patch.userMapEnabled;
  if (patch.freeTierKeysForEmail !== undefined) $set.freeTierKeysForEmail = patch.freeTierKeysForEmail;
  for (const [k, v] of Object.entries(patch.lanes ?? {})) if (v !== undefined) $set[`lanes.${k}`] = v;
  for (const [k, v] of Object.entries(patch.budget ?? {})) if (v !== undefined) $set[`budget.${k}`] = v;
  for (const [k, v] of Object.entries(patch.mcp ?? {})) if (v !== undefined) $set[`mcp.${k}`] = v;
  await AiSettings.updateOne({ _id: "global" }, { $set }, { upsert: true });
  clearAiSettingsCache();
  return getAiSettings();
}

export interface AiFeaturePolicyPatch {
  enabled?: boolean;
  allowedLanes?: AiLane[];
  forcedLane?: AiLane | null;
  defaultLane?: AiLane;
  includedMonthlyLimit?: number;
}

export async function updateFeaturePolicy(
  featureId: string,
  patch: AiFeaturePolicyPatch,
  adminId: mongoose.Types.ObjectId,
): Promise<AiPolicy> {
  const def = aiFeature(featureId);
  const current = (await getAiSettings()).features[featureId];
  const next: AiFeaturePolicyDoc = {
    feature: featureId,
    enabled: patch.enabled ?? current.enabled,
    allowedLanes: (patch.allowedLanes ?? current.allowedLanes).filter((l) => isAiLane(l) && def.lanes.includes(l)),
    forcedLane: patch.forcedLane !== undefined ? patch.forcedLane : current.forcedLane,
    defaultLane: patch.defaultLane ?? current.defaultLane,
    includedMonthlyLimit: patch.includedMonthlyLimit ?? current.includedMonthlyLimit,
  };
  if (!next.allowedLanes?.length) next.allowedLanes = [...def.lanes];
  // A forced lane is, by definition, allowed — and the default must be allowed too.
  if (next.forcedLane && !next.allowedLanes.includes(next.forcedLane)) next.allowedLanes.push(next.forcedLane);
  if (next.defaultLane && !next.allowedLanes.includes(next.defaultLane)) next.defaultLane = next.allowedLanes[0];
  // Replace this feature's entry (pull, then push) — two writes, because
  // Mongo can't pull and push the same array in one update.
  await AiSettings.updateOne({ _id: "global" }, { $pull: { features: { feature: featureId } } }, { upsert: true });
  await AiSettings.updateOne({ _id: "global" }, { $push: { features: next }, $set: { updatedBy: adminId } });
  clearAiSettingsCache();
  return getAiSettings();
}

/** Record that a spend alert fired, so it fires once per period. Returns false if it already had. */
export async function markAlertSent(tag: string): Promise<boolean> {
  // Make sure the document exists, then push only if the tag is absent — an
  // upsert on the conditional filter would collide with the existing _id.
  await AiSettings.updateOne({ _id: "global" }, { $setOnInsert: { alertsSent: [] } }, { upsert: true });
  const res = await AiSettings.updateOne(
    { _id: "global", alertsSent: { $ne: tag } },
    { $push: { alertsSent: { $each: [tag], $slice: -60 } } },
  );
  clearAiSettingsCache();
  return res.modifiedCount > 0;
}

export { AI_LANES };
