import cron from "node-cron";
import { User } from "../models/User.js";
import { scanUserInbox as scanGmail } from "./gmailService.js";
import { scanUserInbox as scanOutlook } from "./outlookService.js";

export function startEmailScanJob(): void {
  // Run at 1 AM daily — scans every connected mailbox per user.
  cron.schedule("0 1 * * *", async () => {
    console.log("[EmailScan] Starting nightly email scan...");
    try {
      const users = await User.find({
        $or: [{ gmailConnected: true }, { outlookConnected: true }],
      });
      console.log(`[EmailScan] Found ${users.length} users with a mailbox connected`);

      for (const user of users) {
        if (user.gmailConnected) {
          try {
            const r = await scanGmail(user);
            if (r.applied > 0) console.log(`[EmailScan] gmail ${user.email}: ${r.applied} update(s) (${r.scanned} scanned)`);
          } catch (err) {
            const e = err as { message?: string };
            console.error(`[EmailScan] gmail ${user.email}:`, e.message);
          }
        }
        if (user.outlookConnected) {
          try {
            const r = await scanOutlook(user);
            if (r.applied > 0) console.log(`[EmailScan] outlook ${user.email}: ${r.applied} update(s) (${r.scanned} scanned)`);
          } catch (err) {
            const e = err as { message?: string };
            console.error(`[EmailScan] outlook ${user.email}:`, e.message);
          }
        }
      }

      console.log("[EmailScan] Nightly scan complete");
    } catch (err) {
      console.error("[EmailScan] Job failed:", err);
    }
  });

  console.log("[EmailScan] Nightly email scan job registered (0 1 * * *)");
}
