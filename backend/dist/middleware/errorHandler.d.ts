/** Last Express middleware: maps Zod, Mongoose, AppError, and unknown errors to JSON. */
import { Request, Response, NextFunction } from "express";
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
