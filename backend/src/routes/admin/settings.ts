import { Router, Request, Response, NextFunction } from "express";
import { SystemSettings, DEFAULT_SETTINGS } from "../../models/SystemSettings.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { systemSettingSchema } from "../../validators/admin.js";

const router = Router();

/** Seed default settings if none exist */
async function ensureDefaults(): Promise<void> {
  const count = await SystemSettings.countDocuments({});
  if (count === 0) {
    await SystemSettings.insertMany(
      DEFAULT_SETTINGS.map((s) => ({ ...s, updatedBy: null }))
    );
  }
}

/** GET / — all settings grouped by category */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureDefaults();
    const settings = await SystemSettings.find({}).sort({ category: 1, key: 1 }).lean();

    // Group by category
    const grouped: Record<string, typeof settings> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    res.json({ settings, grouped });
  } catch (err) {
    next(err);
  }
});

/** PUT / — upsert a single setting */
router.put("/", validate(systemSettingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = getUser(req);
    const { key, value, valueType, description, category } = req.body;

    const existing = await SystemSettings.findOne({ key });
    const oldValue = existing?.value;

    const update: Record<string, unknown> = { value, updatedBy: admin._id };
    if (valueType) update.valueType = valueType;
    if (description !== undefined) update.description = description;
    if (category) update.category = category;

    const setting = await SystemSettings.findOneAndUpdate(
      { key },
      { $set: update },
      { new: true, upsert: true }
    );

    const { ipAddress, userAgent } = getClientInfo(req);
    logAudit({
      userId: admin._id, action: "settings_change", resourceType: "setting",
      resourceId: setting._id, oldValue: { key, value: oldValue }, newValue: { key, value },
      ipAddress, userAgent,
    });

    res.json({ message: "Setting updated", setting });
  } catch (err) {
    next(err);
  }
});

export default router;
