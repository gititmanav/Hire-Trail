/**
 * Defence-in-depth middleware that rejects requests from the seeded demo
 * user. The frontend already gates these features behind `useDemoGate`,
 * but any direct API hit (extension, curl, leaked JWT) should still get
 * a clear 403 instead of silently consuming AI quota or persisting state.
 *
 * Usage:
 *   router.post("/expensive-thing", ensureAuth, blockDemoUser, handler);
 */
import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/User.js";

const DEMO_EMAIL = "demo@hiretrail.com";

export function blockDemoUser(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as IUser | undefined;
  if (user?.email === DEMO_EMAIL) {
    res.status(403).json({
      error: "This feature isn't available on the demo account. Create a free account to use it.",
      code: "DEMO_BLOCKED",
    });
    return;
  }
  next();
}
