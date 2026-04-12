import jwt from "jsonwebtoken";
import { AuthError } from "../errors/AppError.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
export async function ensureAuth(req, _res, next) {
    // Session auth (Passport)
    if (req.isAuthenticated() && req.user) {
        return next();
    }
    // Token auth (Bearer JWT — for Chrome extension)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        try {
            const token = authHeader.slice(7);
            const payload = jwt.verify(token, env.SESSION_SECRET);
            const user = await User.findById(payload.userId);
            if (user && !user.deleted && !user.suspended) {
                req.user = user;
                return next();
            }
        }
        catch { }
    }
    throw new AuthError("Not authenticated");
}
/** Asserts `req.user` (Passport) and returns it as `IUser`. */
export function getUser(req) {
    if (!req.user)
        throw new AuthError("Not authenticated");
    return req.user;
}
export function ensureAdmin(req, _res, next) {
    if (req.isAuthenticated() && req.user && req.user.role === "admin") {
        return next();
    }
    throw new AuthError("Admin access required");
}
//# sourceMappingURL=auth.js.map