/** Proxy endpoint for fetching external resources (e.g. tweakcn themes). */
import { Router, Request, Response, NextFunction } from "express";
import { ensureAuth } from "../middleware/auth.js";

const router = Router();
router.use(ensureAuth);

router.post("/tweakcn", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }
    const parsed = new URL(url);
    if (parsed.hostname !== "tweakcn.com" && parsed.hostname !== "www.tweakcn.com") {
      return res.status(400).json({ error: "Only tweakcn.com URLs are allowed" });
    }
    const response = await fetch(url, {
      headers: { "User-Agent": "HireTrail/1.0" },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch theme" });
    }
    const html = await response.text();
    res.json({ html });
  } catch (err) {
    next(err);
  }
});

export default router;
