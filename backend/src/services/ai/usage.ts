/**
 * Usage metering + quota helpers (task 3).
 *
 *   recordUsage()        — one AiUsage row per model call (cost snapshotted)
 *   monthlyTotals()      — sum tokens + cost for a user this period
 *   assertWithinQuota()  — throw 429 before a default-key call would exceed the cap
 *   usageSummary()       — shape for GET /api/ai/usage (byok vs default views)
 */
import mongoose from "mongoose";

import {
  AiUsage,
  currentPeriod,
  periodResetsAt,
  type AiOpType,
} from "../../models/AiUsage.js";
import { estimateCostUsd } from "./pricing.js";
import { AppError } from "../../errors/AppError.js";

export interface RecordUsageInput {
  userId: string | mongoose.Types.ObjectId;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  opType: AiOpType;
  byok: boolean;
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  try {
    const tokensIn = Math.max(0, Math.round(input.tokensIn || 0));
    const tokensOut = Math.max(0, Math.round(input.tokensOut || 0));
    await AiUsage.create({
      userId: input.userId,
      period: currentPeriod(),
      provider: input.provider,
      model: input.model,
      tokensIn,
      tokensOut,
      estCostUsd: estimateCostUsd(input.model, tokensIn, tokensOut),
      opType: input.opType,
      byok: input.byok,
    });
  } catch (err) {
    // Metering must never break the user-facing call.
    console.warn("[aiUsage] record failed:", err);
  }
}

export interface MonthlyTotals {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estCostUsd: number;
}

export async function monthlyTotals(
  userId: string | mongoose.Types.ObjectId,
  period: string = currentPeriod(),
): Promise<MonthlyTotals> {
  const rows = await AiUsage.aggregate<{
    _id: null;
    tokensIn: number;
    tokensOut: number;
    estCostUsd: number;
  }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId.toString()), period } },
    {
      $group: {
        _id: null,
        tokensIn: { $sum: "$tokensIn" },
        tokensOut: { $sum: "$tokensOut" },
        estCostUsd: { $sum: "$estCostUsd" },
      },
    },
  ]);
  const r = rows[0];
  const tokensIn = r?.tokensIn ?? 0;
  const tokensOut = r?.tokensOut ?? 0;
  return {
    tokensIn,
    tokensOut,
    totalTokens: tokensIn + tokensOut,
    estCostUsd: Math.round((r?.estCostUsd ?? 0) * 1e6) / 1e6,
  };
}

/** Throw 429 if a default-key user has hit their monthly token cap. No-op when
 *  the limit is 0 (unlimited) or the user is on their own key. */
export async function assertWithinQuota(
  userId: string | mongoose.Types.ObjectId,
  monthlyTokenLimit: number,
): Promise<void> {
  if (!monthlyTokenLimit || monthlyTokenLimit <= 0) return;
  const { totalTokens } = await monthlyTotals(userId);
  if (totalTokens >= monthlyTokenLimit) {
    throw new AppError(
      "You've reached this month's free AI quota. Add your own provider key in Settings → AI Providers to keep going — it resets on the 1st.",
      429,
    );
  }
}

export interface UsageSummary {
  mode: "byok" | "default";
  period: string;
  // BYOK view:
  tokensIn?: number;
  tokensOut?: number;
  estCostUsd?: number;
  // Default-key view:
  used?: number;
  limit?: number;
  usedPct?: number;
  resetsAt?: string;
}

/** Build the GET /api/ai/usage payload for a user. */
export async function usageSummary(
  userId: string | mongoose.Types.ObjectId,
  opts: { byok: boolean; monthlyTokenLimit: number },
): Promise<UsageSummary> {
  const period = currentPeriod();
  const totals = await monthlyTotals(userId, period);
  if (opts.byok) {
    return {
      mode: "byok",
      period,
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      estCostUsd: totals.estCostUsd,
    };
  }
  const limit = opts.monthlyTokenLimit > 0 ? opts.monthlyTokenLimit : 0;
  const used = totals.totalTokens;
  const usedPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 0;
  return {
    mode: "default",
    period,
    used,
    limit,
    usedPct,
    resetsAt: periodResetsAt().toISOString(),
  };
}
