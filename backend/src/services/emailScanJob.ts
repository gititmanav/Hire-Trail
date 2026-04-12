import cron from "node-cron";
import { User } from "../models/User.js";
import { scanUserInbox } from "./gmailService.js";

export function startEmailScanJob(): void {
  // Run at 1 AM daily
  cron.schedule("0 1 * * *", async () => {
    console.log("[EmailScan] Starting nightly email scan...");
    try {
      const users = await User.find({ gmailConnected: true });
      console.log(`[EmailScan] Found ${users.length} users with Gmail connected`);

      for (const user of users) {
        try {
          const count = await scanUserInbox(user);
          if (count > 0) {
            console.log(`[EmailScan] User ${user.email}: ${count} rejection(s) detected`);
          }
        } catch (err: any) {
          console.error(`[EmailScan] Error scanning ${user.email}:`, err.message);
        }
      }

      console.log("[EmailScan] Nightly scan complete");
    } catch (err) {
      console.error("[EmailScan] Job failed:", err);
    }
  });

  console.log("[EmailScan] Nightly email scan job registered (0 1 * * *)");
}
