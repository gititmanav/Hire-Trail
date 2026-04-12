import { Router } from "express";
import { ensureAuth } from "../middleware/auth.js";
const router = Router();
router.use(ensureAuth);
// POST connect — placeholder
router.post("/connect", async (_req, res, _next) => {
    res.status(501).json({ error: "Not implemented" });
});
// GET status
router.get("/status", async (_req, res, _next) => {
    res.json({ connected: false });
});
// POST scan — placeholder
router.post("/scan", async (_req, res, _next) => {
    res.status(501).json({ error: "Not implemented" });
});
export default router;
//# sourceMappingURL=email.js.map