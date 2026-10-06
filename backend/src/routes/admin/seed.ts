import { Router, Request, Response, NextFunction } from "express";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { runSeed, clearSeedData } from "../../utils/seedData.js";

const router = Router();

/** POST /run — reset the demo account: its data is replaced with a fresh set
 *  dated around today, exactly as `npm run seed` does. `runSeed` alone adds
 *  on top of what's there, so a second press would double the demo. There's
 *  deliberately no "clear" on its own — the landing's "Try the demo" needs an
 *  account with data in it. */
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    await clearSeedData();
    const result = await runSeed();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "seed", resourceType: "system",
      metadata: result, ipAddress, userAgent,
    });

    res.json({ message: "Demo account reset", ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
