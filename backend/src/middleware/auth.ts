import { Request, Response, NextFunction } from "express";
import { AuthError } from "../errors/AppError.js";
import { IUser } from "../models/User.js";

export function ensureAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  throw new AuthError("Not authenticated");
}

/** Asserts `req.user` (Passport) and returns it as `IUser`. */
export function getUser(req: Request): IUser {
  if (!req.user) throw new AuthError("Not authenticated");
  return req.user as IUser;
}
