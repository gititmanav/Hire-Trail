import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthError } from "../errors/AppError.js";
import { IUser, User } from "../models/User.js";
import { env } from "../config/env.js";

/** Session cookie or Bearer JWT — for maintenance middleware (does not attach user if unauthenticated). */
export async function tryGetAuthedUser(req: Request): Promise<IUser | null> {
  if (req.isAuthenticated() && req.user) {
    return req.user as IUser;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, env.SESSION_SECRET) as { userId: string };
      const user = await User.findById(payload.userId);
      if (user && !user.deleted && !user.suspended) {
        return user;
      }
    } catch {
      /* invalid token */
    }
  }
  return null;
}

export async function ensureAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Session auth (Passport)
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  // Token auth (Bearer JWT — for Chrome extension)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, env.SESSION_SECRET) as { userId: string };
      const user = await User.findById(payload.userId);
      if (user && !user.deleted && !user.suspended) {
        (req as any).user = user;
        return next();
      }
    } catch {}
  }
  // Use next(err) instead of throw — Express 4 doesn't catch async throws
  next(new AuthError("Not authenticated"));
}

/** Asserts `req.user` (Passport) and returns it as `IUser`. */
export function getUser(req: Request): IUser {
  if (!req.user) throw new AuthError("Not authenticated");
  return req.user as IUser;
}

export function ensureAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.isAuthenticated() && req.user && (req.user as IUser).role === "admin") {
    return next();
  }
  next(new AuthError("Admin access required"));
}
