/**
 * OAuth `state` for connecting a mailbox.
 *
 * The state names the account the mailbox will be attached to, so it must be
 * one we issued (HMAC over SESSION_SECRET), recent (10 minutes), and — at the
 * callback — for the account that is signed in in this browser. Without the
 * last check, someone could start a connect on their own account and send
 * the consent link to someone else: the victim's mailbox would land on the
 * attacker's account.
 */
import crypto from "crypto";

import { env } from "../config/env.js";

const MAX_AGE_MS = 10 * 60_000;

function mac(payload: string): string {
  return crypto.createHmac("sha256", `${env.SESSION_SECRET}:oauth-state`).update(payload).digest("base64url");
}

export function signOAuthState(userId: string, provider: "gmail" | "outlook"): string {
  const payload = `${provider}.${userId}.${Date.now().toString(36)}.${crypto.randomBytes(6).toString("base64url")}`;
  return `${payload}.${mac(payload)}`;
}

/** The user id the state was issued for, or null when it isn't valid for
 *  this provider, has expired, or belongs to someone other than `sessionUserId`. */
export function verifyOAuthState(state: string, provider: "gmail" | "outlook", sessionUserId: string | null): string | null {
  const parts = String(state || "").split(".");
  if (parts.length !== 5) return null;
  const [p, userId, ts, nonce, sig] = parts;
  const payload = `${p}.${userId}.${ts}.${nonce}`;
  const want = Buffer.from(mac(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  if (p !== provider) return null;
  const issued = parseInt(ts, 36);
  if (!Number.isFinite(issued) || Date.now() - issued > MAX_AGE_MS) return null;
  if (!sessionUserId || sessionUserId !== userId) return null;
  return userId;
}
