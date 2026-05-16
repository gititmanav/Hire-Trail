/**
 * Gmail OAuth + read-only inbox scan. The actual classification + status update logic
 * lives in `services/email/intake.ts` (source-agnostic).
 */
import { google, gmail_v1 } from "googleapis";
import { env } from "../config/env.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { User, IUser } from "../models/User.js";
import { Application } from "../models/Application.js";
import { processIncomingEmail, type NormalizedEmail, type ProcessOutcome } from "./email/intake.js";

const DEFAULT_QUERY_WINDOW_DAYS = 1;
const MAX_MESSAGES_PER_SCAN = 80;

function getOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GMAIL_REDIRECT_URI
  );
}

export function getAuthUrl(userId: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state: userId,
  });
}

export async function handleCallback(code: string, userId: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh token received");

  client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });

  const encryptedToken = encrypt(tokens.refresh_token);
  await User.findByIdAndUpdate(userId, {
    gmailRefreshToken: encryptedToken,
    gmailConnected: true,
    gmailEmail: profile.data.emailAddress || null,
  });
}

export async function disconnectGmail(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.gmailRefreshToken) return;

  try {
    const client = getOAuth2Client();
    const refreshToken = decrypt(user.gmailRefreshToken);
    client.setCredentials({ refresh_token: refreshToken });
    await client.revokeToken(refreshToken);
  } catch {
    // Revocation failed — still clear local tokens.
  }

  await User.findByIdAndUpdate(userId, {
    gmailRefreshToken: null,
    gmailConnected: false,
    gmailEmail: null,
    gmailLastSyncAt: null,
  });
}

export interface ScanResult {
  scanned: number;
  applied: number;
  skipped: number;
}

export async function scanUserInbox(user: IUser, opts: { windowDays?: number } = {}): Promise<ScanResult> {
  if (!user.gmailRefreshToken || !user.gmailConnected) return { scanned: 0, applied: 0, skipped: 0 };

  const client = getOAuth2Client();
  try {
    const refreshToken = decrypt(user.gmailRefreshToken);
    client.setCredentials({ refresh_token: refreshToken });
  } catch {
    await User.findByIdAndUpdate(user._id, { gmailConnected: false, gmailRefreshToken: null });
    return { scanned: 0, applied: 0, skipped: 0 };
  }

  const gmail = google.gmail({ version: "v1", auth: client });

  const apps = await Application.find({
    userId: user._id,
    archived: { $ne: true },
  });

  if (apps.length === 0) {
    await User.findByIdAndUpdate(user._id, { gmailLastSyncAt: new Date() });
    return { scanned: 0, applied: 0, skipped: 0 };
  }

  const windowDays = opts.windowDays ?? DEFAULT_QUERY_WINDOW_DAYS;

  let listRes: gmail_v1.Schema$ListMessagesResponse;
  try {
    const r = await gmail.users.messages.list({
      userId: "me",
      q: `newer_than:${windowDays}d`,
      maxResults: MAX_MESSAGES_PER_SCAN,
    });
    listRes = r.data;
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; code?: string };
    if (e.response?.status === 401 || e.code === "invalid_grant") {
      await User.findByIdAndUpdate(user._id, { gmailConnected: false, gmailRefreshToken: null });
    }
    throw err;
  }

  const messages = listRes.messages || [];
  let applied = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const email = normalizeGmailMessage(msg.id, full.data);
      if (!email) { skipped++; continue; }

      const outcome: ProcessOutcome = await processIncomingEmail(user, email, apps);
      if ("applied" in outcome) applied++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  await User.findByIdAndUpdate(user._id, { gmailLastSyncAt: new Date() });
  return { scanned: messages.length, applied, skipped };
}

/** Extract text body from Gmail's recursive payload. Prefers text/plain, falls back to HTML strip. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const queue: gmail_v1.Schema$MessagePart[] = [payload];
  let htmlFallback = "";

  while (queue.length) {
    const part = queue.shift()!;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.mimeType === "text/html" && part.body?.data && !htmlFallback) {
      htmlFallback = Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.parts) queue.push(...part.parts);
  }
  return htmlFallback.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeGmailMessage(id: string, msg: gmail_v1.Schema$Message): NormalizedEmail | null {
  const headers = msg.payload?.headers || [];
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
  const bodyText = extractBody(msg.payload || undefined);
  if (!from || !subject) return null;

  const fromDomain = from.match(/@([a-zA-Z0-9.-]+)/)?.[1]?.toLowerCase() ?? "";
  const fromName = from.match(/^([^<]+)/)?.[1]?.trim() ?? "";

  return { id, source: "gmail", from, fromDomain, fromName, subject, bodyText };
}
