import { SystemSettings } from "../models/SystemSettings.js";
import { env } from "../config/env.js";
import { isAdminEmail } from "../utils/admin.js";

export const MAINTENANCE_AUTH_MESSAGE =
  "The service is undergoing scheduled maintenance. Please try again later.";

const CACHE_MS = 3000;
let cache: { value: boolean; at: number } | null = null;

export function clearMaintenanceModeCache(): void {
  cache = null;
}

/** Who may use HireTrail during maintenance: the configured bypass email and
 *  every admin (ADMIN_EMAILS) — otherwise switching maintenance on would lock
 *  the admin out of the switch that turns it off. */
export function isMaintenanceBypassEmail(email?: string | null): boolean {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  const bypass = env.MAINTENANCE_BYPASS_EMAIL.trim().toLowerCase();
  if (!bypass) return false;
  return email.trim().toLowerCase() === bypass;
}

export async function getMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.value;

  const doc = await SystemSettings.findOne({ key: "maintenance_mode" }).lean();
  const value = Boolean(doc?.value);
  cache = { value, at: now };
  return value;
}
