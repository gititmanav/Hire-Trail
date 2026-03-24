import { Router, Request, Response, NextFunction } from "express";

const router = Router();

/** GET / — list available roles with descriptions */
router.get("/", async (_req: Request, res: Response, _next: NextFunction) => {
  const roles = [
    {
      role: "user",
      description: "Default role. Can manage their own applications, resumes, contacts, and deadlines.",
      permissions: [
        "manage_own_applications",
        "manage_own_resumes",
        "manage_own_contacts",
        "manage_own_deadlines",
        "view_own_analytics",
        "use_job_search",
        "use_import_export",
      ],
    },
    {
      role: "admin",
      description: "Full access. Can manage all users, view platform analytics, configure system settings, and access all admin features.",
      permissions: [
        "manage_all_users",
        "view_platform_analytics",
        "manage_settings",
        "manage_announcements",
        "view_audit_logs",
        "manage_invites",
        "manage_email_templates",
        "manage_backups",
        "run_seed",
        "view_performance",
        "manage_integrations",
        "view_all_content",
        "manage_storage",
        "impersonate_users",
      ],
    },
  ];

  res.json({ roles });
});

export default router;
