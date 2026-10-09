/**
 * Insights read off the person's own history:
 *
 *  - the reply window — the median whole days from an application's applied
 *    date to its first reply (the first stage move past Applied);
 *  - the sweep — open applications (Applied · OA · Interview) idle for more
 *    than twice that window, with no follow-up still scheduled: the ones that
 *    have most likely gone quiet.
 *
 * Both run as aggregations; only one number per replied application reaches
 * Node (the median needs them all).
 */
import { Types, type PipelineStage } from "mongoose";

import { Application } from "../../models/Application.js";
import { Deadline } from "../../models/Deadline.js";
import { replyWindowFrom, type ReplyWindow } from "./replyWindow.js";
import { SUMMARY_STAGES, withFit } from "./summary.js";

const DAY_MS = 86_400_000;
const SWEEP_STAGES = ["Applied", "OA", "Interview"];
const SWEEP_LIMIT = 300;

/**
 * Reply times over every application, archived ones included. A reply is the
 * first history entry, after the first, in a stage past Applied and dated on
 * or after the applied day. The first entry is skipped: it records where
 * tracking began — an import, a late add or a backdated one can start at OA
 * or Interview — not an answer.
 */
export async function loadReplyWindow(userId: Types.ObjectId): Promise<ReplyWindow> {
  const [row] = await Application.aggregate<{ days: number[] }>([
    { $match: { userId, applicationDate: { $type: "date" }, "stageHistory.1": { $exists: true } } },
    {
      $project: {
        reply: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $slice: ["$stageHistory", 1, { $size: "$stageHistory" }] },
                as: "h",
                cond: {
                  $and: [
                    { $not: [{ $in: ["$$h.stage", ["Drafting", "Applied"]] }] },
                    { $gte: ["$$h.date", "$applicationDate"] },
                  ],
                },
              },
            },
            0,
          ],
        },
        applicationDate: 1,
      },
    },
    { $match: { "reply.date": { $type: "date" } } },
    { $group: { _id: null, days: { $push: { $floor: { $divide: [{ $subtract: ["$reply.date", "$applicationDate"] }, DAY_MS] } } } } },
  ]);
  return replyWindowFrom(row?.days ?? []);
}

/** Applications with an open deadline due from yesterday on: the next step
 *  is already planned — or they chose to keep waiting — so the sweep leaves
 *  them alone. */
function plannedFollowUps(userId: Types.ObjectId, now: number) {
  return Deadline.distinct("applicationId", {
    userId,
    completed: false,
    dueDate: { $gte: new Date(now - DAY_MS) },
    applicationId: { $ne: null },
  });
}

/** The reply window, and the sweep's candidate stages (before sorting). Last
 *  movement = the later of the last history entry and the applied date (a
 *  legacy doc without history has only the latter); idle means more than
 *  `2 × window` whole days since. */
async function sweepContext(userId: Types.ObjectId): Promise<{ replyWindow: ReplyWindow; candidates: PipelineStage[] }> {
  const now = Date.now();
  const [replyWindow, planned] = await Promise.all([loadReplyWindow(userId), plannedFollowUps(userId, now)]);
  return {
    replyWindow,
    candidates: [
      {
        $match: {
          userId,
          // Legacy docs predate `archived` (null matches missing).
          archived: { $in: [false, null] },
          stage: { $in: SWEEP_STAGES },
          _id: { $nin: planned },
        },
      },
      { $addFields: { lastMovedAt: { $max: [{ $arrayElemAt: ["$stageHistory.date", -1] }, "$applicationDate"] } } },
      // floor(idle days) > 2 × window  ⇔  idle ≥ 2 × window + 1 days.
      { $match: { lastMovedAt: { $lte: new Date(now - (2 * replyWindow.days + 1) * DAY_MS) } } },
    ],
  };
}

export async function loadInsights(userId: Types.ObjectId): Promise<{ replyWindow: ReplyWindow; sweepCount: number }> {
  const { replyWindow, candidates } = await sweepContext(userId);
  const [row] = await Application.aggregate<{ n: number }>([...candidates, { $count: "n" }]);
  return { replyWindow, sweepCount: row?.n ?? 0 };
}

/** The sweep itself: longest idle first, in the list's summary shape. */
export async function loadSweep(userId: Types.ObjectId) {
  const { replyWindow, candidates } = await sweepContext(userId);
  const apps = await Application.aggregate<{ _id: Types.ObjectId; tailorSessionId?: Types.ObjectId | null }>([
    ...candidates,
    { $sort: { lastMovedAt: 1, _id: 1 } },
    { $limit: SWEEP_LIMIT },
    { $unset: "lastMovedAt" },
    ...SUMMARY_STAGES,
  ]);
  return { data: await withFit(apps, { withSummary: false }), replyWindow };
}
