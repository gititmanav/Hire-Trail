import { AuthError } from "../errors/AppError.js";
export function ensureAuth(req, _res, next) {
    if (req.isAuthenticated() && req.user) {
        return next();
    }
    throw new AuthError("Not authenticated");
}
/** Asserts `req.user` (Passport) and returns it as `IUser`. */
export function getUser(req) {
    if (!req.user)
        throw new AuthError("Not authenticated");
    return req.user;
}
//# sourceMappingURL=auth.js.map