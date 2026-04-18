/** Feature flags require auth; maintenance status is public for login UI. */
import { Router, Request, Response, NextFunction } from "express";
import { SystemSettings, DEFAULT_SETTINGS } from "../models/SystemSettings.js";
import { ensureAuth } from "../middleware/auth.js";
import { getMaintenanceMode } from "../services/maintenance.js";

const router = Router();

router.get("/maintenance-status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await SystemSettings.countDocuments({});
    if (count === 0) {
      await SystemSettings.insertMany(DEFAULT_SETTINGS.map((s) => ({ ...s, updatedBy: null })));
    }
    const maintenanceMode = await getMaintenanceMode();
    res.json({ maintenanceMode });
  } catch (err) {
    next(err);
  }
});

router.use(ensureAuth);

router.get("/features", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await SystemSettings.countDocuments({});
    if (count === 0) {
      await SystemSettings.insertMany(DEFAULT_SETTINGS.map((s) => ({ ...s, updatedBy: null })));
    }
    const features = await SystemSettings.find({ key: /^feature_/ }).lean();
    const flags: Record<string, boolean> = {};
    for (const f of features) {
      flags[f.key] = Boolean(f.value);
    }
    res.json({ flags });
  } catch (err) {
    next(err);
  }
});

export default router;
