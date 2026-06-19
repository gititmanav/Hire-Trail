/**
 * Clipboard-copy discovery nudge.
 *
 * The extension can copy a tracked job's JD to the clipboard (handy for pasting
 * into Claude), but it's opt-in and off by default. To make users aware the
 * setting exists, every user gets a one-time dismissible notification that
 * deep-links to Settings → Clipboard.
 *
 *  - New users: `ensureClipboardNudge` is called on register.
 *  - Existing users: `seedClipboardNudgeForAll` runs once on server boot.
 *
 * Idempotent: guarded by the user's `clipboardNudgeSeeded` flag, which is
 * claimed atomically so concurrent requests can't double-create. Dismiss
 * archives the notification (resolved:true) rather than deleting it, and the
 * flag stays set regardless — so a dismissed nudge is never re-created.
 */
import mongoose from "mongoose";
import { Notification } from "../../models/Notification.js";
import { User } from "../../models/User.js";

export const CLIPBOARD_NUDGE_TITLE = "Copy job descriptions to your clipboard";
export const CLIPBOARD_NUDGE_MESSAGE =
  "The extension can copy a job's description to your clipboard when you track it — great for pasting into Claude. It's off by default; turn it on in Settings → Clipboard.";

/** Create the clipboard nudge for one user unless it's already been seeded.
 *  The seed is claimed atomically via the `clipboardNudgeSeeded` flag so that
 *  concurrent callers (e.g. repeated /auth/me hits) create exactly one. */
export async function ensureClipboardNudge(
  userId: mongoose.Types.ObjectId,
): Promise<boolean> {
  const claimed = await User.findOneAndUpdate(
    { _id: userId, clipboardNudgeSeeded: { $ne: true } },
    { $set: { clipboardNudgeSeeded: true } },
  )
    .select("_id")
    .lean();
  if (!claimed) return false; // already seeded
  await Notification.create({
    userId,
    type: "clipboard_config",
    title: CLIPBOARD_NUDGE_TITLE,
    message: CLIPBOARD_NUDGE_MESSAGE,
  });
  return true;
}

/** Seed the clipboard nudge for every existing user that hasn't got one yet.
 *  Idempotent — safe to run on every boot. */
export async function seedClipboardNudgeForAll(): Promise<{ created: number }> {
  let created = 0;
  const cursor = User.find({ clipboardNudgeSeeded: { $ne: true } }).select("_id").cursor();
  for await (const u of cursor) {
    if (await ensureClipboardNudge(u._id)) created++;
  }
  return { created };
}
