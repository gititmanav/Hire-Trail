/**
 * The list shape of an application — what `GET /applications?fields=summary`,
 * the sweep and the calendar's hover cards send: no job description (the bulk
 * of every document), and the fit check inlined as a thin summary.
 */
import type { PipelineStage } from "mongoose";

import { TailorSession } from "../../models/TailorSession.js";

/** Thin summary of a TailorSession for inlining into Application list/get responses. */
export interface AppFitSummary {
  sessionId: string;
  status: "processing" | "succeeded" | "failed" | "deferred" | "waiting_assistant";
  /** The one match score, 0–10 (null until computed). */
  score: number | null;
  /** Omitted in list (`fields=summary`) responses — no list surface renders it. */
  summary?: string;
  matchedCount: number;
  missingCount: number;
  /** First few matched skills — surfaced by the Application row AI panel as
   *  a checkmark list. Capped server-side so the response stays small. */
  topMatched: string[];
  errorMessage?: string;
  /** "ai_<reason>" behind a failure, and the lane it ran in. */
  errorCode?: string;
  errorLane?: string;
}

/** Pipeline tail for the summary shape: `jobDescription` becomes a
 *  `hasJobDescription` flag; userId (always the requester), updatedAt and __v
 *  are never rendered. */
export const SUMMARY_STAGES: PipelineStage.FacetPipelineStage[] = [
  { $addFields: { hasJobDescription: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$jobDescription", ""] } } } }, 0] } } },
  { $project: { jobDescription: 0, userId: 0, updatedAt: 0, __v: 0 } },
];

/** Resolve `fit` summaries for a list of applications in one bulk Mongo query.
 *  Returns a map keyed by application id (string). Apps with no tailorSessionId
 *  or a missing session are simply absent from the map (frontend renders the
 *  "no fit yet" state). */
export async function loadFitSummaries(
  apps: Array<{ _id: unknown; tailorSessionId: unknown }>,
  { withSummary = true }: { withSummary?: boolean } = {},
): Promise<Map<string, AppFitSummary>> {
  const sessionIds = apps.map((a) => a.tailorSessionId).filter(Boolean);
  if (sessionIds.length === 0) return new Map();
  const sessions = await TailorSession.find({ _id: { $in: sessionIds } })
    .select("_id status matchScore summary matchedSkills missingSkills errorMessage errorCode errorLane")
    .lean();
  const byId = new Map(sessions.map((s) => [String(s._id), s]));
  const out = new Map<string, AppFitSummary>();
  for (const a of apps) {
    if (!a.tailorSessionId) continue;
    const s = byId.get(String(a.tailorSessionId));
    if (!s) continue;
    out.set(String(a._id), {
      sessionId: String(s._id),
      status: s.status,
      score: typeof s.matchScore === "number" ? s.matchScore : null,
      ...(withSummary && { summary: s.summary || "" }),
      matchedCount: Array.isArray(s.matchedSkills) ? s.matchedSkills.length : 0,
      missingCount: Array.isArray(s.missingSkills) ? s.missingSkills.length : 0,
      topMatched: Array.isArray(s.matchedSkills) ? s.matchedSkills.slice(0, 3) : [],
      errorMessage: s.errorMessage || undefined,
      errorCode: s.errorCode || undefined,
      errorLane: s.errorLane || undefined,
    });
  }
  return out;
}

/** Each application with its `fit` (null when there's none yet). */
export async function withFit<T extends { _id: unknown; tailorSessionId?: unknown }>(
  apps: T[],
  opts: { withSummary?: boolean } = {},
): Promise<Array<T & { fit: AppFitSummary | null }>> {
  const fits = await loadFitSummaries(apps.map((a) => ({ _id: a._id, tailorSessionId: a.tailorSessionId })), opts);
  return apps.map((a) => ({ ...a, fit: fits.get(String(a._id)) || null }));
}
