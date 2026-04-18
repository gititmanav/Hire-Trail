import { Request, Response, NextFunction } from "express";
import { tryGetAuthedUser } from "./auth.js";
import { getMaintenanceMode, isMaintenanceBypassEmail, MAINTENANCE_AUTH_MESSAGE } from "../services/maintenance.js";

function allowUnauthenticatedDuringMaintenance(req: Request): boolean {
  const path = req.originalUrl.split("?")[0];
  if (req.method === "POST" && path.endsWith("/auth/logout")) return true;
  if (req.method === "GET" && path.endsWith("/settings/maintenance-status")) return true;
  return false;
}

/**
 * Blocks all authenticated API use for non-bypass users while maintenance_mode is on.
 * Login/register/token/OAuth enforce separately; this catches existing sessions and Bearer tokens.
 */
export async function rejectMaintenanceForNonBypass(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!(await getMaintenanceMode())) {
      return next();
    }
    if (allowUnauthenticatedDuringMaintenance(req)) {
      return next();
    }
    const user = await tryGetAuthedUser(req);
    if (!user) {
      return next();
    }
    if (isMaintenanceBypassEmail(user.email)) {
      return next();
    }
    res.status(503).json({
      error: MAINTENANCE_AUTH_MESSAGE,
      code: "MAINTENANCE",
    });
  } catch (err) {
    next(err);
  }
}
