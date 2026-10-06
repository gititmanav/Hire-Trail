/**
 * A personal access token for HireTrail's MCP server (Claude Code and other
 * assistants). The secret ("ht_mcp_…") is shown once; only its SHA-256 is
 * stored, so a database read can't be replayed as a login.
 *
 * Scopes: "read" (look things up), "write" (change applications, notes,
 * contacts; propose profile and resume changes), "ai" (pick up AI tasks that
 * run in the assistant lane). Revoking is immediate — the server checks on
 * every call.
 */
import mongoose, { Schema, Document } from "mongoose";

export const MCP_SCOPES = ["read", "write", "ai"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export interface IMcpToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  /** sha256(secret), hex. */
  tokenHash: string;
  /** The last four characters of the secret, for recognising it in a list. */
  last4: string;
  scopes: McpScope[];
  /** The client that last used it ("claude-code 2.1.4"), from MCP's initialize. */
  lastClient: string;
  lastUsedAt: Date | null;
  /** The first time a client said hello (initialize) with it — "connected".
   *  Missing on tokens made before 2026-10-06 (tokenView falls back). */
  helloAt: Date | null;
  /** The first tool it called, and when — the connection proven end to end. */
  firstTool: string;
  firstToolAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mcpTokenSchema = new Schema<IMcpToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    tokenHash: { type: String, required: true, unique: true },
    last4: { type: String, default: "" },
    scopes: { type: [String], enum: MCP_SCOPES, default: ["read", "write", "ai"] },
    lastClient: { type: String, default: "", maxlength: 120 },
    lastUsedAt: { type: Date, default: null },
    helloAt: { type: Date, default: null },
    firstTool: { type: String, default: "", maxlength: 80 },
    firstToolAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const out = ret as Record<string, unknown>;
        delete out.tokenHash;
        delete out.__v;
        return out;
      },
    },
  },
);

mcpTokenSchema.index({ userId: 1, revokedAt: 1 });

export const McpToken = mongoose.model<IMcpToken>("McpToken", mcpTokenSchema);
