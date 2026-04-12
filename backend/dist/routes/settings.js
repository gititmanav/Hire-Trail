/** Public (authenticated) settings endpoint — returns feature flags for any logged-in user. */
import { Router } from "express";
import { SystemSettings, DEFAULT_SETTINGS } from "../models/SystemSettings.js";
import { ensureAuth } from "../middleware/auth.js";
const router = Router();
router.use(ensureAuth);
router.get("/features", async (_req, res, next) => {
    try {
        const count = await SystemSettings.countDocuments({});
        if (count === 0) {
            await SystemSettings.insertMany(DEFAULT_SETTINGS.map((s) => ({ ...s, updatedBy: null })));
        }
        const features = await SystemSettings.find({ key: /^feature_/ }).lean();
        const flags = {};
        for (const f of features) {
            flags[f.key] = Boolean(f.value);
        }
        res.json({ flags });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=settings.js.map