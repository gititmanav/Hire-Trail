import { Router, Request, Response, NextFunction } from "express";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { runSeed, clearSeedData } from "../../utils/seedData.js";

const router = Router();

/** POST /run — run seed data generation */
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const result = await runSeed();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "seed", resourceType: "system",
      metadata: result, ipAddress, userAgent,
    });

    res.json({ message: "Seed data created successfully", ...result });
  } catch (err) {
    next(err);
  }
});

/** POST /clear — clear seed data */
router.post("/clear", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const result = await clearSeedData();

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "seed_clear", resourceType: "system",
      metadata: result, ipAddress, userAgent,
    });

    res.json({ message: result.cleared ? "Seed data cleared" : "No seed data found", ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
