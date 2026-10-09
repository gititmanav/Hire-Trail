/**
 * POST /api/mcp — HireTrail's MCP server (Streamable HTTP, stateless, JSON
 * responses). Each request carries a personal access token
 * (`Authorization: Bearer ht_mcp_…`, made in Settings → AI) and gets a fresh
 * server bound to that person; nothing is held between requests, so it runs
 * the same on any serverless instance.
 *
 * Gates, in order: a live token → MCP switched on (Admin → AI) → the account
 * (not the demo, not suspended, not locked out by maintenance) → this hour's
 * call budget. Each failure is a JSON-RPC error with a sentence a person can
 * act on.
 *
 * Connect Claude Code:
 *   claude mcp add --transport http hiretrail https://<host>/api/mcp \
 *     --header "Authorization: Bearer ht_mcp_…"
 */
import { Router, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { User } from "../models/User.js";
import { getAiSettings } from "../services/ai/settings.js";
import { getMaintenanceMode, mayUseDuringMaintenance, MAINTENANCE_AUTH_MESSAGE } from "../services/maintenance.js";
import { buildMcpServer } from "../services/mcp/server.js";
import { chargeRate, noteFirstTool, touchToken, verifyToken } from "../services/mcp/tokens.js";
import type { AiUser } from "../services/ai/gateway.js";

const router = Router();
const DEMO_EMAIL = "demo@hiretrail.com";

function rpcError(res: Response, status: number, message: string, headers: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(status).json({ jsonrpc: "2.0", error: { code: status === 401 ? -32001 : -32000, message }, id: null });
}

/** The tool a `tools/call` request runs. */
function toolOf(body: unknown): string | null {
  const msgs = Array.isArray(body) ? body : [body];
  for (const m of msgs) {
    const call = m as { method?: string; params?: { name?: unknown } };
    if (call?.method === "tools/call" && typeof call.params?.name === "string") return call.params.name;
  }
  return null;
}

/** The client's name and version, when this request is MCP's `initialize`. */
function clientOf(body: unknown): string | null {
  const msgs = Array.isArray(body) ? body : [body];
  for (const m of msgs) {
    const info = (m as { method?: string; params?: { clientInfo?: { name?: string; version?: string } } })?.method === "initialize"
      ? (m as { params?: { clientInfo?: { name?: string; version?: string } } }).params?.clientInfo
      : null;
    if (info?.name) return [info.name, info.version].filter(Boolean).join(" ");
  }
  return null;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const auth = String(req.headers.authorization ?? "");
    const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const token = secret ? await verifyToken(secret) : null;
    if (!token) {
      return rpcError(res, 401, "This HireTrail connection isn't valid — it may have been removed. Make a new one in HireTrail → Settings → AI.", {
        "WWW-Authenticate": 'Bearer realm="hiretrail"',
      });
    }

    const policy = await getAiSettings();
    if (!policy.mcp.enabled) return rpcError(res, 503, "HireTrail has switched off assistant connections for now.");

    const user = await User.findById(token.userId).select("name email role suspended aiOverride").lean();
    if (!user || user.suspended) return rpcError(res, 403, "This HireTrail account can't be used right now.");
    if (user.email === DEMO_EMAIL) return rpcError(res, 403, "The demo account can't connect an assistant. Create a free account to use it.");
    if (!mayUseDuringMaintenance(user) && (await getMaintenanceMode())) {
      return rpcError(res, 503, MAINTENANCE_AUTH_MESSAGE);
    }

    if (!(await chargeRate(token._id, "call", policy.mcp))) {
      return rpcError(res, 429, `That's the hourly limit of ${policy.mcp.callsPerHour} assistant calls. Try again next hour.`, { "Retry-After": "600" });
    }
    void touchToken(token, clientOf(req.body)).catch(() => undefined);
    const tool = toolOf(req.body);
    if (tool) void noteFirstTool(token, tool).catch(() => undefined);

    const server = buildMcpServer({ user: user as unknown as AiUser & { name?: string }, token, policy });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request failed:", err);
    if (!res.headersSent) rpcError(res, 500, "Something went wrong on HireTrail's side. Try again in a moment.");
  }
});

// Stateless: there's no stream to open and no session to end.
router.all("/", (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST");
  rpcError(res, 405, "Use POST.");
});

export default router;
