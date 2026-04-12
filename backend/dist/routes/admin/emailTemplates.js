import { Router } from "express";
import { EmailTemplate } from "../../models/EmailTemplate.js";
import { getUser } from "../../middleware/auth.js";
import { logAudit, getClientInfo } from "../../utils/auditLog.js";
import { validate } from "../../middleware/validate.js";
import { emailTemplateSchema, updateEmailTemplateSchema } from "../../validators/admin.js";
import { NotFoundError } from "../../errors/AppError.js";
const router = Router();
/** GET / — list templates */
router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const [data, total] = await Promise.all([
            EmailTemplate.find({})
                .sort({ type: 1, name: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            EmailTemplate.countDocuments({}),
        ]);
        res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    catch (err) {
        next(err);
    }
});
/** GET /:id */
router.get("/:id", async (req, res, next) => {
    try {
        const template = await EmailTemplate.findById(req.params.id).lean();
        if (!template)
            throw new NotFoundError("Email template");
        res.json(template);
    }
    catch (err) {
        next(err);
    }
});
/** POST / — create template */
router.post("/", validate(emailTemplateSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        const template = await EmailTemplate.create(req.body);
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "template_create", resourceType: "email_template",
            resourceId: template._id, newValue: { name: template.name },
            ipAddress, userAgent,
        });
        res.status(201).json(template);
    }
    catch (err) {
        next(err);
    }
});
/** PUT /:id */
router.put("/:id", validate(updateEmailTemplateSchema), async (req, res, next) => {
    try {
        const admin = getUser(req);
        const template = await EmailTemplate.findById(req.params.id);
        if (!template)
            throw new NotFoundError("Email template");
        const oldName = template.name;
        Object.assign(template, req.body);
        await template.save();
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "template_update", resourceType: "email_template",
            resourceId: template._id, oldValue: { name: oldName },
            newValue: { name: template.name },
            ipAddress, userAgent,
        });
        res.json(template);
    }
    catch (err) {
        next(err);
    }
});
/** DELETE /:id */
router.delete("/:id", async (req, res, next) => {
    try {
        const admin = getUser(req);
        const template = await EmailTemplate.findByIdAndDelete(req.params.id);
        if (!template)
            throw new NotFoundError("Email template");
        const { ipAddress, userAgent } = getClientInfo(req);
        logAudit({
            userId: admin._id, action: "template_delete", resourceType: "email_template",
            resourceId: template._id, oldValue: { name: template.name },
            ipAddress, userAgent,
        });
        res.json({ message: "Template deleted" });
    }
    catch (err) {
        next(err);
    }
});
export default router;
//# sourceMappingURL=emailTemplates.js.map