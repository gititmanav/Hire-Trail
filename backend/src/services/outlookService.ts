/**
 * Outlook (Microsoft Graph) OAuth: connect, callback, disconnect.
 *
 * Outlook is hidden from Connectors until it joins the review-queue scan
 * (Revamp.md, AI revamp decision: inbox = review queue only). Existing
 * connections can still be disconnected.
 */
import { ConfidentialClientApplication } from "@azure/msal-node";
import { env } from "../config/env.js";
import { encrypt } from "../utils/encryption.js";
import { User } from "../models/User.js";
import { signOAuthState } from "../utils/oauthState.js";

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
    state: signOAuthState(userId, "outlook"),
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
