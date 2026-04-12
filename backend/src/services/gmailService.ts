import { google } from "googleapis";
import { env } from "../config/env.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { User, IUser } from "../models/User.js";
import { Application } from "../models/Application.js";
import { Notification } from "../models/Notification.js";

const REJECTION_KEYWORDS = [
  "unfortunately",
  "not moving forward",
  "other candidates",
  "regret to inform",
  "position has been filled",
  "not been selected",
  "decided not to move forward",
];

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

  // Get user's Gmail email
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

export async function scanUserInbox(user: IUser): Promise<number> {
  if (!user.gmailRefreshToken || !user.gmailConnected) return 0;

  const client = getOAuth2Client();
  try {
    const refreshToken = decrypt(user.gmailRefreshToken);
    client.setCredentials({ refresh_token: refreshToken });
  } catch {
    // Token decryption failed — mark disconnected
    await User.findByIdAndUpdate(user._id, { gmailConnected: false, gmailRefreshToken: null });
    return 0;
  }

  const gmail = google.gmail({ version: "v1", auth: client });

  // Get user's tracked applications for matching
  const applications = await Application.find({
    userId: user._id,
    stage: { $ne: "Rejected" },
    archived: { $ne: true },
  }).lean();

  if (applications.length === 0) return 0;

  // Build company domain map for matching
  const companyDomains = new Map<string, typeof applications[0]>();
  for (const app of applications) {
    const companyLower = app.company.toLowerCase();
    companyDomains.set(companyLower, app);
    // Also try extracting domain from jobUrl
    if (app.jobUrl) {
      try {
        const domain = new URL(app.jobUrl).hostname.replace(/^www\./, "").split(".")[0];
        companyDomains.set(domain, app);
      } catch {}
    }
  }

  let matchCount = 0;

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:1d",
      maxResults: 50,
    });

    const messages = res.data.messages || [];

    for (const msg of messages) {
      try {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const headers = full.data.payload?.headers || [];
        const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
        const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";

        // Extract body text
        let bodyText = "";
        const parts = full.data.payload?.parts || [];
        if (parts.length > 0) {
          const textPart = parts.find((p) => p.mimeType === "text/plain");
          if (textPart?.body?.data) {
            bodyText = Buffer.from(textPart.body.data, "base64url").toString("utf8");
          }
        } else if (full.data.payload?.body?.data) {
          bodyText = Buffer.from(full.data.payload.body.data, "base64url").toString("utf8");
        }

        const combined = `${subject} ${bodyText}`.toLowerCase();

        // Check for rejection keywords
        const isRejection = REJECTION_KEYWORDS.some((kw) => combined.includes(kw));
        if (!isRejection) continue;

        // Try to match to an application by sender domain
        const senderDomain = from.match(/@([a-zA-Z0-9.-]+)/)?.[1]?.split(".")[0]?.toLowerCase() || "";
        const senderName = from.match(/^([^<]+)/)?.[1]?.trim().toLowerCase() || "";

        let matchedApp = companyDomains.get(senderDomain);
        if (!matchedApp) {
          // Try matching by company name in from or subject
          for (const [key, app] of companyDomains) {
            if (senderName.includes(key) || from.toLowerCase().includes(key) || subject.toLowerCase().includes(key)) {
              matchedApp = app;
              break;
            }
          }
        }

        if (!matchedApp) continue;

        // Check if we already created a notification for this application
        const existingNotif = await Notification.findOne({
          userId: user._id,
          applicationId: matchedApp._id,
          type: "rejection_detected",
        });
        if (existingNotif) continue;

        // Update application stage to Rejected
        await Application.findByIdAndUpdate(matchedApp._id, {
          stage: "Rejected",
          $push: { stageHistory: { stage: "Rejected", date: new Date() } },
        });

        // Create notification
        await Notification.create({
          userId: user._id,
          type: "rejection_detected",
          title: `Rejection detected: ${matchedApp.company}`,
          message: `A rejection email from ${matchedApp.company} was detected for your "${matchedApp.role}" application. Stage updated to Rejected.`,
          applicationId: matchedApp._id,
        });

        matchCount++;
      } catch {
        // Skip individual message errors
      }
    }

    // Update last sync time
    await User.findByIdAndUpdate(user._id, { gmailLastSyncAt: new Date() });
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.code === "invalid_grant") {
      await User.findByIdAndUpdate(user._id, {
        gmailConnected: false,
        gmailRefreshToken: null,
      });
    }
    throw err;
  }

  return matchCount;
}

export async function disconnectGmail(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.gmailRefreshToken) return;

  // Try to revoke at Google
  try {
    const client = getOAuth2Client();
    const refreshToken = decrypt(user.gmailRefreshToken);
    client.setCredentials({ refresh_token: refreshToken });
    await client.revokeToken(refreshToken);
  } catch {
    // Revocation failed — still clear local tokens
  }

  await User.findByIdAndUpdate(userId, {
    gmailRefreshToken: null,
    gmailConnected: false,
    gmailEmail: null,
    gmailLastSyncAt: null,
  });
}
