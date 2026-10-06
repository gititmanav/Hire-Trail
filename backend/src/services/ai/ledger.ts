/**
 * The ledger and the Included budget (written only by the gateway).
 *
 * Metering like a bank:
 *   reserve  — before an Included call, insert a `reserved` row holding the
 *              call's worst-case cost, THEN check the caps with that row
 *              already counted. Parallel calls see each other's holds, so the
 *              cap can't be overshot; if the check fails the hold is released
 *              (the row becomes a `refused` row) and the call is refused.
 *   settle   — the same row gets the real tokens and cost.
 *   a hold nobody settled (the function was killed) keeps counting at its
 *   worst case — the only safe direction to be wrong in.
 *
 * Every refusal, cache hit and failure is a row too: "spend that hides is
 * spend that gets argued about."
 */
import mongoose from "mongoose";

import { AiUsage, currentPeriod, periodResetsAt, type IAiUsage } from "../../models/AiUsage.js";
import { Notification } from "../../models/Notification.js";
import { User } from "../../models/User.js";
import type { AiLane, AiProviderId } from "./providerIds.js";
import type { AiErrorCode } from "./errors.js";
import type { AiPolicy } from "./settings.js";
import { markAlertSent } from "./settings.js";

export interface LedgerBase {
  userId: mongoose.Types.ObjectId;
  feature: string;
  lane: AiLane;
  provider: AiProviderId | "none";
  model: string;
  keyId?: mongoose.Types.ObjectId | null;
  promptVersion: string;
  jobId?: mongoose.Types.ObjectId | null;
  countsAsUse?: boolean;
}

/** Money already committed on the Included lane this period (settled + holds). */
const committed = { $cond: [{ $eq: ["$status", "reserved"] }, "$reservedUsd", "$estCostUsd"] };

export async function includedSpend(period: string, userId?: mongoose.Types.ObjectId): Promise<number> {
  const match: Record<string, unknown> = { period, lane: "included", status: { $in: ["reserved", "settled"] } };
  if (userId) match.userId = userId;
  const [row] = await AiUsage.aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: committed } } },
  ]);
  return row?.total ?? 0;
}

/** Successful Included uses of one feature by one user this period. */
export async function includedUses(period: string, userId: mongoose.Types.ObjectId, feature: string): Promise<number> {
  return AiUsage.countDocuments({
    period, userId, feature, lane: "included", countsAsUse: true,
    status: { $in: ["reserved", "settled"] }, ok: { $ne: false },
  });
}

export async function recordRefusal(base: LedgerBase, code: AiErrorCode): Promise<void> {
  try {
    await AiUsage.create({
      ...base, period: currentPeriod(), status: "refused", ok: false, errorCode: code,
      tokensIn: 0, tokensOut: 0, estCostUsd: 0, reservedUsd: 0, countsAsUse: false,
    });
  } catch (err) {
    console.warn("[ai-ledger] refusal write failed:", err instanceof Error ? err.message : err);
  }
}

export async function recordCacheHit(base: LedgerBase): Promise<void> {
  try {
    await AiUsage.create({
      ...base, period: currentPeriod(), status: "settled", ok: true, cached: true,
      tokensIn: 0, tokensOut: 0, estCostUsd: 0, reservedUsd: 0,
    });
  } catch (err) {
    console.warn("[ai-ledger] cache-hit write failed:", err instanceof Error ? err.message : err);
  }
}

export interface Reservation {
  id: mongoose.Types.ObjectId | null;
}

export type BudgetRefusal = { code: "cap_reached" | "limit_reached" | "feature_limit"; limit?: number };

/**
 * Hold `worstCaseUsd` against the budget. Returns the hold, or a refusal.
 * Only the Included lane is budgeted; other lanes get a plain pending row.
 */
export async function reserve(
  base: LedgerBase,
  worstCaseUsd: number,
  policy: AiPolicy,
  opts: { allowanceUsd: number | null; featureLimit: number },
): Promise<{ ok: true; reservation: Reservation } | { ok: false; refusal: BudgetRefusal }> {
  const period = currentPeriod();
  const row = await AiUsage.create({
    ...base, period, status: "reserved", ok: undefined,
    tokensIn: 0, tokensOut: 0, estCostUsd: 0,
    reservedUsd: base.lane === "included" ? worstCaseUsd : 0,
  });
  if (base.lane !== "included") return { ok: true, reservation: { id: row._id } };

  const release = async (refusal: BudgetRefusal) => {
    await AiUsage.updateOne({ _id: row._id }, { $set: { status: "refused", ok: false, errorCode: refusal.code, reservedUsd: 0 } });
    return { ok: false as const, refusal };
  };

  const cap = policy.budget.monthlyCapUsd;
  const platform = await includedSpend(period);
  if (cap <= 0 || platform > cap) return release({ code: "cap_reached" });

  const allowance = opts.allowanceUsd ?? policy.budget.perUserAllowanceUsd;
  if (allowance > 0) {
    const mine = await includedSpend(period, base.userId);
    if (mine > allowance) return release({ code: "limit_reached" });
  }

  if (base.countsAsUse && opts.featureLimit > 0) {
    const uses = await includedUses(period, base.userId, base.feature);
    if (uses > opts.featureLimit) return release({ code: "feature_limit", limit: opts.featureLimit });
  }

  void maybeAlert(policy, platform, cap);
  return { ok: true, reservation: { id: row._id } };
}

export async function settle(
  reservation: Reservation,
  outcome: { ok: boolean; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number; errorCode?: AiErrorCode | null },
): Promise<void> {
  if (!reservation.id) return;
  try {
    await AiUsage.updateOne(
      { _id: reservation.id },
      {
        $set: {
          status: "settled",
          ok: outcome.ok,
          tokensIn: outcome.tokensIn,
          tokensOut: outcome.tokensOut,
          estCostUsd: outcome.costUsd,
          reservedUsd: 0,
          latencyMs: outcome.latencyMs,
          errorCode: outcome.errorCode ?? null,
          // A failed call isn't a "use" of a limited feature.
          ...(outcome.ok ? {} : { countsAsUse: false }),
        },
      },
    );
  } catch (err) {
    console.warn("[ai-ledger] settle failed:", err instanceof Error ? err.message : err);
  }
}

/** Notify admins once per period as Included spend crosses each threshold. */
async function maybeAlert(policy: AiPolicy, spent: number, cap: number): Promise<void> {
  if (cap <= 0) return;
  const pct = (spent / cap) * 100;
  const crossed = policy.budget.alertAtPct.filter((t) => pct >= t).sort((a, b) => b - a)[0];
  if (!crossed) return;
  const tag = `${currentPeriod()}:${crossed}`;
  if (policy.alertsSent.includes(tag)) return;
  try {
    if (!(await markAlertSent(tag))) return;
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    await Notification.insertMany(
      admins.map((a) => ({
        userId: a._id,
        type: "info",
        title: `Included AI is at ${Math.round(pct)}% of this month's cap`,
        message: `$${spent.toFixed(2)} of $${cap.toFixed(2)} used. Adjust the cap or limits in Admin → AI.`,
      })),
    );
  } catch (err) {
    console.warn("[ai-ledger] spend alert failed:", err instanceof Error ? err.message : err);
  }
}

/* ---------------- reading the ledger (usage lenses) ---------------- */

/** Legacy rows (pre-2026-10) name an opType instead of a feature. */
const LEGACY_FEATURE: Record<string, string> = {
  resume_parse: "resume.import",
  profile_merge: "profile.merge",
  jd_analysis: "fit.check",
  field_extract: "posting.read",
  jd_clean: "posting.read",
  thread_classify: "inbox.sort",
  resume_rewrite: "resume.tailor",
};

export function featureOf(row: Pick<IAiUsage, "feature" | "opType">): string {
  return row.feature ?? (row.opType ? LEGACY_FEATURE[row.opType] ?? "other" : "other");
}

export interface UsageSummary {
  period: string;
  resetsAt: string;
  included: { spentUsd: number; allowanceUsd: number; capUsd: number };
  byFeature: { feature: string; calls: number; failures: number; tokens: number; costUsd: number; lane: Record<string, number> }[];
  totals: { calls: number; tokens: number; costUsd: number; byokCostUsd: number };
}

/** The user's own month: Included allowance progress + what each feature used. */
export async function userUsage(userId: mongoose.Types.ObjectId, policy: AiPolicy, allowanceOverride: number | null): Promise<UsageSummary> {
  const period = currentPeriod();
  const rows = await AiUsage.find({ userId, period }).select("feature opType lane byok status ok estCostUsd reservedUsd tokensIn tokensOut").lean();
  const byFeature = new Map<string, UsageSummary["byFeature"][number]>();
  let spent = 0;
  let calls = 0, tokens = 0, cost = 0, byokCost = 0;
  for (const r of rows) {
    if (r.status === "refused") continue;
    const f = featureOf(r);
    const lane = r.lane ?? (r.byok ? "byok" : "included");
    const c = r.status === "reserved" ? r.reservedUsd ?? 0 : r.estCostUsd ?? 0;
    const entry = byFeature.get(f) ?? { feature: f, calls: 0, failures: 0, tokens: 0, costUsd: 0, lane: {} };
    entry.calls += 1;
    if (r.ok === false) entry.failures += 1;
    entry.tokens += (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
    entry.costUsd += c;
    entry.lane[lane] = (entry.lane[lane] ?? 0) + 1;
    byFeature.set(f, entry);
    calls += 1;
    tokens += (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
    cost += c;
    if (lane === "included") spent += c;
    if (lane === "byok") byokCost += c;
  }
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return {
    period,
    resetsAt: periodResetsAt().toISOString(),
    included: {
      spentUsd: round(spent),
      allowanceUsd: allowanceOverride ?? policy.budget.perUserAllowanceUsd,
      capUsd: policy.budget.monthlyCapUsd,
    },
    byFeature: [...byFeature.values()].map((e) => ({ ...e, costUsd: round(e.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
    totals: { calls, tokens, costUsd: round(cost), byokCostUsd: round(byokCost) },
  };
}
