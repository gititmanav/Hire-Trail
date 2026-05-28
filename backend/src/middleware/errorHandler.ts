/** Last Express middleware: maps Zod, Mongoose, AppError, and unknown errors to JSON. */
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { reportBug } from "../services/bugReporter.js";
import type { IUser } from "../models/User.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    res.status(400).json({
      error: "Validation failed",
      details: messages,
    });
    return;
  }

  // Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      error: "Validation failed",
      details: messages,
    });
    return;
  }

  // Mongoose cast errors (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
    return;
  }

  // Mongoose duplicate key
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] || "field";
    res.status(409).json({ error: `${field} already exists` });
    return;
  }

  // Our custom AppError
  if (err instanceof AppError) {
    // 5xx AppErrors (e.g. AIProviderError on upstream 502s) are still bugs
    // worth surfacing to the admin panel — they fired despite our safeguards.
    if (err.statusCode >= 500) reportFromRequest(err, req, "backend_500");
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Unknown errors — always a bug.
  console.error("Unhandled error:", err);
  reportFromRequest(err, req, "backend_500");
  res.status(500).json({
    error: "Internal server error",
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

function reportFromRequest(err: Error, req: Request, source: "backend_500"): void {
  // Fire-and-forget — reportBug swallows its own errors. We deliberately don't
  // await this so the response isn't delayed by the DB write.
  void reportBug({
    source,
    errorMessage: err.message || err.name || "Unknown error",
    errorStack: err.stack,
    route: req.originalUrl,
    method: req.method,
    userId: (req.user as IUser | undefined)?._id ?? null,
    userAgent: req.get("user-agent"),
    requestBody: req.body,
  });
}
