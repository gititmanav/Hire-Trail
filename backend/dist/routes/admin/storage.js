import { Router } from "express";
import { Resume } from "../../models/Resume.js";
import { env } from "../../config/env.js";
const router = Router();
/** GET / — storage overview with resume file info */
router.get("/", async (_req, res, next) => {
    try {
        const files = await Resume.find({ fileUrl: { $ne: null } })
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .lean();
        // Try to get Cloudinary usage stats if configured
        let cloudinaryStats = null;
        if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
            try {
                const { cloudinary } = await import("../../config/cloudinary.js");
                const usage = await cloudinary.api.usage();
                // Cloudinary free tier: 25GB storage, 25GB bandwidth
                const FREE_STORAGE = 25 * 1024 * 1024 * 1024; // 25 GB
                const FREE_BANDWIDTH = 25 * 1024 * 1024 * 1024; // 25 GB
                cloudinaryStats = {
                    totalStorage: usage.storage?.usage || usage.space?.usage || 0,
                    storageLimit: usage.storage?.limit || usage.space?.limit || FREE_STORAGE,
                    bandwidth: usage.bandwidth?.usage || 0,
                    bandwidthLimit: usage.bandwidth?.limit || FREE_BANDWIDTH,
                    transformations: usage.transformations?.usage || 0,
                };
            }
            catch (err) {
                console.error("Cloudinary usage fetch failed:", err);
            }
        }
        // Detect potential orphans (files in DB without a valid URL pattern)
        const orphans = files.filter((f) => f.filePublicId && (!f.fileUrl || f.fileUrl === ""));
        res.json({
            stats: {
                totalFiles: files.length,
                orphanedFiles: orphans.length,
                cloudinary: cloudinaryStats,
            },
            files: files.map((f) => ({
                _id: f._id,
                name: f.name,
                fileName: f.fileName,
                targetRole: f.targetRole,
                fileUrl: f.fileUrl,
                filePublicId: f.filePublicId,
                user: f.userId,
                createdAt: f.createdAt,
            })),
            orphans: orphans.map((f) => ({
                _id: f._id,
                name: f.name,
                filePublicId: f.filePublicId,
                user: f.userId,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=storage.js.map