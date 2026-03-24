import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

const router = Router();

/** GET / — basic server and database performance metrics */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    // Database stats
    let dbStats = null;
    try {
      const db = mongoose.connection.db;
      if (db) {
        const stats = await db.stats();
        const collections = await db.listCollections().toArray();
        dbStats = {
          collections: collections.length,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexSize: stats.indexSize,
          objects: stats.objects,
          avgObjSize: stats.avgObjSize,
        };
      }
    } catch {
      // DB stats not available
    }

    res.json({
      server: {
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        memory: {
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
          external: mem.external,
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
          rssMB: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
        },
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
      database: {
        status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        stats: dbStats,
      },
    });
  } catch (err) {
    next(err);
  }
});

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export default router;
