/**
 * Per-token, per-hour MCP call counters (fixed windows). Kept in Mongo, not
 * memory, because every serverless instance must see the same count. Rows
 * expire two hours after their window opens.
 */
import mongoose, { Schema } from "mongoose";

export interface IMcpRate {
  /** `${tokenId}:${YYYY-MM-DDTHH}` (UTC hour). */
  _id: string;
  calls: number;
  writes: number;
  expireAt: Date;
}

const mcpRateSchema = new Schema<IMcpRate>(
  {
    _id: { type: String, required: true },
    calls: { type: Number, default: 0 },
    writes: { type: Number, default: 0 },
    expireAt: { type: Date, required: true },
  },
  { versionKey: false },
);

mcpRateSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const McpRate = mongoose.model<IMcpRate>("McpRate", mcpRateSchema);
