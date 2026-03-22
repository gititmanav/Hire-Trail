import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
/** Parses `req.body` with Zod; replaces body with the parsed value (safe for downstream handlers). */
export declare function validate(schema: ZodSchema): (req: Request, _res: Response, next: NextFunction) => void;
