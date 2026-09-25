/** Ledger of one-time data migrations that have completed (the `migrations`
 *  collection). Boot reads it in one query and skips everything already
 *  applied — see services/migrations/runBootMigrations.ts. */
import mongoose, { Schema } from "mongoose";

export interface IMigration {
  /** The migration's name — stable forever once shipped. */
  _id: string;
  ranAt: Date;
  /** What it changed (counts), for the record. */
  result: Record<string, number>;
}

const migrationSchema = new Schema<IMigration>(
  {
    _id: { type: String, required: true },
    ranAt: { type: Date, required: true },
    result: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false },
);

export const Migration = mongoose.model<IMigration>("Migration", migrationSchema, "migrations");
