import { Router, Request, Response, NextFunction } from "express";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();
router.use(ensureAuth);

// POST connect — placeholder
router.post(
  "/connect",
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.status(501).json({ error: "Not implemented" });
  }
);

// GET status
router.get(
  "/status",
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.json({ connected: false });
  }
);

// POST scan — placeholder
router.post(
  "/scan",
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.status(501).json({ error: "Not implemented" });
  }
);

export default router;
