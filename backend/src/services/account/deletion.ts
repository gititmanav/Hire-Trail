/**
 * Deleting an account — possible, deliberately a little hard, and complete.
 *
 *   request   — a reason, the word DELETE, and proof it's them (their
 *               password; a Google-only account types its email address).
 *               The account is scheduled for deletion in 14 days and signed
 *               out everywhere; an email says when, and how to keep it.
 *   cancel    — signing in before the date keeps everything (and says so).
 *   purge     — after the date, everything the account owns is erased: the
 *               tracker, resumes and their files, the profile, AI keys,
 *               routes, jobs and usage, assistant connections, inbox scans,
 *               notifications, feedback, sessions — and Google's access to
 *               the mailbox is revoked. Then the user document itself.
 *
 * Due purges run at boot and, at most hourly per instance, on /auth/me —
 * every app load — so nothing waits on a cron the host may not have.
 */
import bcrypt from "bcrypt";
import mongoose from "mongoose";

import { User, type IUser } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { ResumeDocument } from "../../models/ResumeDocument.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { Notification } from "../../models/Notification.js";
import { TailorSession } from "../../models/TailorSession.js";
import { MasterProfile } from "../../models/MasterProfile.js";
import { Feedback } from "../../models/Feedback.js";
import { AuditLog } from "../../models/AuditLog.js";
import { AdminLoginEvent } from "../../models/AdminLoginEvent.js";
import { Company } from "../../models/Company.js";
import { Invite } from "../../models/Invite.js";
import { AIProviderConfig } from "../../models/AIProviderConfig.js";
import { AiKey } from "../../models/AiKey.js";
import { AiRoute } from "../../models/AiRoute.js";
import { AiJob } from "../../models/AiJob.js";
import { AiUsage } from "../../models/AiUsage.js";
import { McpToken } from "../../models/McpToken.js";
import { McpRate } from "../../models/McpRate.js";
import { EmailScanJob } from "../../models/EmailScanJob.js";
import { EmailScanCandidate } from "../../models/EmailScanCandidate.js";
import { AppError } from "../../errors/AppError.js";
import { env } from "../../config/env.js";
import { disconnectGmail } from "../gmailService.js";
import { disconnectOutlook } from "../outlookService.js";
import { isMailerConfigured, sendEmail } from "../mailer.js";

export const DELETION_GRACE_DAYS = 14;
export const DELETION_REASONS = ["found_job", "not_useful", "privacy", "too_much", "other"] as const;
export type DeletionReason = (typeof DELETION_REASONS)[number];

const DEMO_EMAIL = "demo@hiretrail.com";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

async function tell(to: string, subject: string, lines: string[]): Promise<void> {
  if (!isMailerConfigured()) return;
  const html = lines.map((l) => `<p style="margin:0 0 12px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#171717">${l}</p>`).join("");
  try {
    await sendEmail({ to, subject, html, text: lines.join("\n\n").replace(/<[^>]+>/g, "") });
  } catch (err) {
    console.warn("[account] deletion email not sent:", err instanceof Error ? err.message : err);
  }
}

/** Sign the account out everywhere (session documents store the user id in JSON). */
async function endSessions(userId: string): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  try {
    await db.collection("sessions").deleteMany({ session: { $regex: `"user":"${userId}"` } });
  } catch {
    // best-effort — the session layer also refuses deleted accounts
  }
}

export async function requestDeletion(
  userId: mongoose.Types.ObjectId,
  input: { reason: DeletionReason; note?: string; confirm: string; password?: string; email?: string },
): Promise<{ scheduledFor: Date }> {
  const user = await User.findById(userId).select("email name password googleId deletion");
  if (!user) throw new AppError("Account not found.", 404);
  if (user.email === DEMO_EMAIL) throw new AppError("The demo account can't be deleted.", 403);
  if (input.confirm !== "DELETE") throw new AppError('Type DELETE to confirm.', 400);
  if (user.password) {
    if (!input.password || !(await bcrypt.compare(input.password, user.password))) {
      throw new AppError("That password isn't right.", 400, { code: "deletion_password" });
    }
  } else if ((input.email ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError("Type your account's email address to confirm.", 400, { code: "deletion_email" });
  }

  const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000);
  await User.updateOne(
    { _id: user._id },
    { $set: { deletion: { requestedAt: new Date(), scheduledFor, reason: input.reason, note: (input.note ?? "").trim().slice(0, 500) } } },
  );
  await endSessions(String(user._id));
  void tell(user.email, "Your HireTrail account will be deleted", [
    `Hi ${user.name.split(" ")[0] || "there"},`,
    `Your HireTrail account is scheduled for deletion on <strong>${fmt(scheduledFor)}</strong>. On that day everything in it is erased for good — applications, resumes, your profile, contacts and AI settings.`,
    `Changed your mind? Just <a href="${env.CLIENT_URL}">sign in</a> before then and it's kept, exactly as it is.`,
  ]);
  return { scheduledFor };
}

/** Signing in during the grace period keeps the account. True if it did. */
export async function cancelScheduledDeletion(user: Pick<IUser, "_id" | "email" | "name"> & { deletion?: IUser["deletion"] }): Promise<boolean> {
  const fresh = user.deletion === undefined ? await User.findById(user._id).select("deletion").lean() : user;
  if (!fresh?.deletion?.scheduledFor) return false;
  await User.updateOne({ _id: user._id }, { $set: { deletion: null } });
  void tell(user.email, "Your HireTrail account is staying", [
    `Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""} — you signed in, so your account is no longer scheduled for deletion. Everything is just as you left it.`,
  ]);
  return true;
}

/** Erase an account and everything it owns. Idempotent. */
export async function purgeUser(userId: mongoose.Types.ObjectId): Promise<void> {
  const id = String(userId);
  // External access first; failures can't block erasing our side.
  await Promise.allSettled([disconnectGmail(id), disconnectOutlook(id)]);

  // Uploaded resume files.
  const resumes = await Resume.find({ userId }).select("_id filePublicId").lean();
  const publicIds = resumes.map((r) => r.filePublicId).filter(Boolean) as string[];
  if (publicIds.length && env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    try {
      const { cloudinary } = await import("../../config/cloudinary.js");
      await cloudinary.api.delete_resources(publicIds, { resource_type: "image" });
    } catch (err) {
      console.warn("[account] resume files not removed from storage:", err instanceof Error ? err.message : err);
    }
  }

  const tokens = await McpToken.find({ userId }).select("_id").lean();
  const scans = await EmailScanJob.find({ userId }).select("_id").lean();
  await Promise.all([
    Application.deleteMany({ userId }),
    Resume.deleteMany({ userId }),
    ResumeDocument.deleteMany({ $or: [{ userId }, { resumeId: { $in: resumes.map((r) => r._id) } }] }),
    Contact.deleteMany({ userId }),
    Deadline.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    TailorSession.deleteMany({ userId }),
    MasterProfile.deleteMany({ userId }),
    Feedback.deleteMany({ userId }),
    AuditLog.deleteMany({ userId }),
    AdminLoginEvent.deleteMany({ userId }),
    AIProviderConfig.deleteMany({ userId }),
    AiKey.deleteMany({ owner: "user", userId }),
    AiRoute.deleteMany({ scope: "user", userId }),
    AiJob.deleteMany({ userId }),
    AiUsage.deleteMany({ userId }),
    McpToken.deleteMany({ userId }),
    McpRate.deleteMany({ _id: { $regex: `^(${tokens.map((t) => String(t._id)).join("|") || "none"}):` } }),
    EmailScanCandidate.deleteMany({ $or: [{ userId }, { scanJobId: { $in: scans.map((s) => s._id) } }] }),
    EmailScanJob.deleteMany({ userId }),
    Company.updateMany({ users: userId }, { $pull: { users: userId } }),
    Invite.deleteMany({ createdBy: userId }),
    Invite.updateMany({ "usedBy.userId": userId }, { $pull: { usedBy: { userId } } }),
  ]);
  // Companies nobody tracks any more are orphans.
  await Company.deleteMany({ users: { $size: 0 } });
  await endSessions(id);
  // Hard delete — the unique email index frees the address for a new account.
  await User.deleteOne({ _id: userId }).setOptions({ includeDeleted: true });
}

/** Purge every account whose grace period is over. */
export async function purgeDueDeletions(): Promise<number> {
  const due = await User.find({ "deletion.scheduledFor": { $lte: new Date() } })
    .setOptions({ includeDeleted: true })
    .select("_id email name")
    .limit(25)
    .lean();
  for (const u of due) {
    try {
      await purgeUser(u._id);
      void tell(u.email, "Your HireTrail account has been deleted", [
        "As you asked, your HireTrail account and everything in it have been erased.",
        "Thanks for using HireTrail — and if you're leaving because you got the job: congratulations.",
      ]);
    } catch (err) {
      console.error(`[account] purge of ${u._id} failed — retried next time:`, err);
    }
  }
  return due.length;
}

const PURGE_EVERY_MS = 60 * 60_000;
let lastPurge = 0;

/** Cheap enough to call on every /auth/me: one indexed query, hourly per instance. */
export function maybePurgeDueDeletions(): void {
  if (Date.now() - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = Date.now();
  void purgeDueDeletions().catch((err) => console.error("[account] due-deletion sweep failed:", err));
}
