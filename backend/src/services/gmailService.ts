/**
 * Gmail OAuth: connect, callback, disconnect. Reading the inbox is the scan
 * (services/email/inboxScan.ts) — it fills the review queue; nothing is
 * applied to an application without the person reviewing it.
 */
import { google } from "googleapis";
import { env } from "../config/env.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { User } from "../models/User.js";
import { signOAuthState } from "../utils/oauthState.js";

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
    state: signOAuthState(userId, "gmail"),
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
    // Reset first-scan state too — reconnecting should feel like a clean
    // start (consent picker shows again, picker offers 5/10/15 again). Without
    // this, a user who disconnects to "try fresh" gets locked out of the
    // picker because the old completed/consent flags persist.
    gmailFirstScanCompleted: false,
    gmailFirstScanDays: null,
    gmailScanConsent: null,
  });
}
