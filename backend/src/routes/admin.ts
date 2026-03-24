import { Router, Request, Response, NextFunction } from "express";
import { ensureAdmin } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { AdminLoginEvent } from "../models/AdminLoginEvent.js";

const router = Router();

router.get(
  "/overview",
  ensureAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [totalUsers, adminUsers, recentLogins, users] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: "admin" }),
        AdminLoginEvent.find({})
          .sort({ loggedInAt: -1 })
          .limit(100)
          .lean(),
        User.find({})
          .sort({ createdAt: -1 })
          .select("name email role createdAt updatedAt")
          .lean(),
      ]);

      res.json({
        stats: {
          totalUsers,
          adminUsers,
          regularUsers: totalUsers - adminUsers,
          totalLoginsTracked: recentLogins.length,
        },
        users,
        recentLogins,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
