/**
 * One action over many of the person's applications (POST /applications/batch):
 * archive, unarchive, delete, a stage move — and the Undo of a stage move made
 * moments ago. Every query is scoped to the user. `matched` counts the ids
 * that are theirs; `modified` the ones the action actually changed.
 */
import { Types } from "mongoose";

import { Application } from "../../models/Application.js";
import type { BatchApplicationsInput } from "../../validators/applications.js";
import { archivedFields, deleteApplications, UNARCHIVED_FIELDS } from "./write.js";

/** A stage move this recent is undone by removing it — no history noise. */
const UNDO_STAGE_MS = 15 * 60_000;

type Owned = { _id: { $in: Types.ObjectId[] }; userId: Types.ObjectId };

function applyAction(owned: Owned, input: Exclude<BatchApplicationsInput, { action: "delete" }>) {
  switch (input.action) {
    case "archive":
      // Already archived ones keep their date and reason.
      return Application.updateMany({ ...owned, archived: { $ne: true } }, { $set: archivedFields(input.reason) });
    case "unarchive":
      return Application.updateMany({ ...owned, archived: true }, { $set: UNARCHIVED_FIELDS });
    case "stage":
      // $push creates the history on a legacy doc that has none.
      return Application.updateMany(
        { ...owned, stage: { $ne: input.stage } },
        { $set: { stage: input.stage }, $push: { stageHistory: { stage: input.stage, date: new Date() } } },
      );
    case "undoStage":
      // Pop the last move and return to the stage before it. The first entry
      // is where the application started — never undone.
      return Application.updateMany(
        {
          ...owned,
          "stageHistory.1": { $exists: true },
          $expr: { $gt: [{ $arrayElemAt: ["$stageHistory.date", -1] }, new Date(Date.now() - UNDO_STAGE_MS)] },
        },
        [
          { $set: { stageHistory: { $slice: ["$stageHistory", { $subtract: [{ $size: "$stageHistory" }, 1] }] } } },
          { $set: { stage: { $arrayElemAt: ["$stageHistory.stage", -1] } } },
        ],
      );
  }
}

export async function batchApplications(
  userId: Types.ObjectId,
  input: BatchApplicationsInput,
): Promise<{ matched: number; modified: number }> {
  const ids = [...new Set(input.ids.map((id) => id.toLowerCase()))].map((id) => new Types.ObjectId(id));
  if (input.action === "delete") {
    const deleted = await deleteApplications(userId, ids);
    return { matched: deleted, modified: deleted };
  }
  const owned: Owned = { _id: { $in: ids }, userId };
  const [matched, { modifiedCount }] = await Promise.all([Application.countDocuments(owned), applyAction(owned, input)]);
  return { matched, modified: modifiedCount };
}
