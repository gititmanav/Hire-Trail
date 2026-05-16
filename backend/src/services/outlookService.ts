/**
 * Outlook (Microsoft Graph) OAuth + read-only mailbox scan.
 * Mirrors `gmailService.ts` — classification + status update lives in `services/email/intake.ts`.
 */
import { ConfidentialClientApplication } from "@azure/msal-node";
import { env } from "../config/env.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { User, IUser } from "../models/User.js";
import { Application } from "../models/Application.js";
import { processIncomingEmail, type NormalizedEmail, type ProcessOutcome } from "./email/intake.js";

const DEFAULT_QUERY_WINDOW_DAYS = 1;
const MAX_MESSAGES_PER_SCAN = 80;
const SCOPES = ["Mail.Read", "offline_access", "User.Read"];

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}`,
    },
  });
}

export function isOutlookConfigured(): boolean {
  return !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
}

export async function getAuthUrl(userId: string): Promise<string> {
  const client = getMsalClient();
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: env.OUTLOOK_REDIRECT_URI,
    state: userId,
    prompt: "consent",
  });
}

export async function handleCallback(code: string, userId: string): Promise<void> {
  const client = getMsalClient();
  const tokenResponse = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: env.OUTLOOK_REDIRECT_URI,
  });

  // MSAL caches the refresh token internally; we serialize and persist it.
  const cache = client.getTokenCache().serialize();
  const parsed = JSON.parse(cache) as { RefreshToken?: Record<string, { secret: string }> };
  const rtRecord = parsed.RefreshToken && Object.values(parsed.RefreshToken)[0];
  const refreshToken = rtRecord?.secret;
  if (!refreshToken) throw new Error("No refresh token received from Microsoft");

  const account = tokenResponse?.account;
  const outlookEmail = account?.username || null;

  await User.findByIdAndUpdate(userId, {
    outlookRefreshToken: encrypt(refreshToken),
    outlookConnected: true,
    outlookEmail,
  });
}

export async function disconnectOutlook(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    outlookRefreshToken: null,
    outlookConnected: false,
    outlookEmail: null,
    outlookLastSyncAt: null,
  });
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const client = getMsalClient();
  const result = await client.acquireTokenByRefreshToken({
    refreshToken,
    scopes: SCOPES,
  });
  if (!result?.accessToken) throw new Error("Failed to refresh Outlook access token");
  return result.accessToken;
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
}

interface GraphMessagesResponse {
  value: GraphMessage[];
}

export interface ScanResult {
  scanned: number;
  applied: number;
  skipped: number;
}

export async function scanUserInbox(user: IUser, opts: { windowDays?: number } = {}): Promise<ScanResult> {
  if (!user.outlookRefreshToken || !user.outlookConnected) return { scanned: 0, applied: 0, skipped: 0 };

  let accessToken: string;
  try {
    const refreshToken = decrypt(user.outlookRefreshToken);
    accessToken = await getAccessToken(refreshToken);
  } catch {
    await User.findByIdAndUpdate(user._id, { outlookConnected: false, outlookRefreshToken: null });
    return { scanned: 0, applied: 0, skipped: 0 };
  }

  const apps = await Application.find({ userId: user._id, archived: { $ne: true } });
  if (apps.length === 0) {
    await User.findByIdAndUpdate(user._id, { outlookLastSyncAt: new Date() });
    return { scanned: 0, applied: 0, skipped: 0 };
  }

  const windowDays = opts.windowDays ?? DEFAULT_QUERY_WINDOW_DAYS;
  const sinceIso = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();

  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$select", "id,subject,bodyPreview,body,from,receivedDateTime");
  url.searchParams.set("$top", String(MAX_MESSAGES_PER_SCAN));
  url.searchParams.set("$filter", `receivedDateTime ge ${sinceIso}`);
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
  });
  if (!r.ok) {
    if (r.status === 401) {
      await User.findByIdAndUpdate(user._id, { outlookConnected: false, outlookRefreshToken: null });
    }
    throw new Error(`Microsoft Graph ${r.status}`);
  }

  const data = (await r.json()) as GraphMessagesResponse;
  const messages = data.value || [];

  let applied = 0;
  let skipped = 0;

  for (const msg of messages) {
    try {
      const email = normalizeGraphMessage(msg);
      if (!email) { skipped++; continue; }
      const outcome: ProcessOutcome = await processIncomingEmail(user, email, apps);
      if ("applied" in outcome) applied++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  await User.findByIdAndUpdate(user._id, { outlookLastSyncAt: new Date() });
  return { scanned: messages.length, applied, skipped };
}

function normalizeGraphMessage(msg: GraphMessage): NormalizedEmail | null {
  if (!msg.id) return null;
  const fromAddress = msg.from?.emailAddress?.address || "";
  const fromName = msg.from?.emailAddress?.name || "";
  const subject = msg.subject || "";
  if (!fromAddress || !subject) return null;

  let bodyText = "";
  if (msg.body?.content) {
    if (msg.body.contentType === "html") {
      bodyText = msg.body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } else {
      bodyText = msg.body.content;
    }
  } else if (msg.bodyPreview) {
    bodyText = msg.bodyPreview;
  }

  const fromDomain = fromAddress.split("@")[1]?.toLowerCase() || "";

  return {
    id: msg.id,
    source: "outlook",
    from: fromAddress,
    fromDomain,
    fromName,
    subject,
    bodyText,
  };
}
