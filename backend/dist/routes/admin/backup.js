import { Router } from "express";
import { User } from "../../models/User.js";
import { Application } from "../../models/Application.js";
import { Resume } from "../../models/Resume.js";
import { Contact } from "../../models/Contact.js";
import { Deadline } from "../../models/Deadline.js";
import { AuditLog } from "../../models/AuditLog.js";
import { Announcement } from "../../models/Announcement.js";
import { SystemSettings } from "../../models/SystemSettings.js";
import { Invite } from "../../models/Invite.js";
import { EmailTemplate } from "../../models/EmailTemplate.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { NotFoundError } from "../../errors/AppError.js";
const router = Router();
/** POST /export — full database export as JSON */
router.post("/export", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const [users, applications, resumes, contacts, deadlines, auditLogs, announcements, settings, invites, templates] = await Promise.all([
            User.find({}).setOptions({ includeDeleted: true }).select("-password").lean(),
            Application.find({}).lean(),
            Resume.find({}).lean(),
            Contact.find({}).lean(),
            Deadline.find({}).lean(),
            AuditLog.find({}).sort({ timestamp: -1 }).limit(10000).lean(),
            Announcement.find({}).lean(),
            SystemSettings.find({}).lean(),
            Invite.find({}).lean(),
            EmailTemplate.find({}).lean(),
        ]);
        const backup = {
            exportedAt: new Date().toISOString(),
            exportedBy: { name: admin.name, email: admin.email },
            data: {
                users, applications, resumes, contacts, deadlines,
                auditLogs, announcements, settings, invites, templates,
            },
            counts: {
                users: users.length, applications: applications.length,
                resumes: resumes.length, contacts: contacts.length,
                deadlines: deadlines.length, auditLogs: auditLogs.length,
            },
        };
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "backup_export", resourceType: "system",
            metadata: { counts: backup.counts }, ipAddress, userAgent,
        });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=hiretrail-backup-${new Date().toISOString().slice(0, 10)}.json`);
        res.json(backup);
    }
    catch (err) {
        next(err);
    }
});
/** GET /list — backup history placeholder */
router.get("/list", async (_req, res) => {
    // Placeholder — in the future this could list stored backups
    res.json({ backups: [], message: "Backup history not yet implemented. Use the export button to create a backup." });
});
/** POST /user-export/:userId — GDPR user data export */
router.post("/user-export/:userId", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const targetUser = await User.findById(req.params.userId)
            .setOptions({ includeDeleted: true })
            .select("-password")
            .lean();
        if (!targetUser)
            throw new NotFoundError("User");
        const uid = targetUser._id;
        const [applications, resumes, contacts, deadlines] = await Promise.all([
            Application.find({ userId: uid }).lean(),
            Resume.find({ userId: uid }).lean(),
            Contact.find({ userId: uid }).lean(),
            Deadline.find({ userId: uid }).lean(),
        ]);
        const data = {
            exportedAt: new Date().toISOString(),
            user: targetUser,
            applications, resumes, contacts, deadlines,
            counts: {
                applications: applications.length, resumes: resumes.length,
                contacts: contacts.length, deadlines: deadlines.length,
            },
        };
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "user_data_export", resourceType: "user",
            resourceId: uid, metadata: { targetEmail: targetUser.email },
            ipAddress, userAgent,
        });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=user-${targetUser.email}-export.json`);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=backup.js.map