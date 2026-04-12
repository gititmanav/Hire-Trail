import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/User.js";
export declare function ensureAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
/** Asserts `req.user` (Passport) and returns it as `IUser`. */
export declare function getUser(req: Request): IUser;
export declare function ensureAdmin(req: Request, _res: Response, next: NextFunction): void;
