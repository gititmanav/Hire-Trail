import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/** Parses `req.body` with Zod; replaces body with the parsed value (safe for downstream handlers). */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
