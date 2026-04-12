import { env } from "../config/env.js";
function parseAdminEmails() {
    return new Set(env.ADMIN_EMAILS.split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean));
}
export function isAdminEmail(email) {
    if (!email)
        return false;
    return parseAdminEmails().has(email.toLowerCase());
}
//# sourceMappingURL=admin.js.map