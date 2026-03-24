import { env } from "../config/env.js";

function parseAdminEmails(): Set<string> {
  return new Set(
    env.ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return parseAdminEmails().has(email.toLowerCase());
}
