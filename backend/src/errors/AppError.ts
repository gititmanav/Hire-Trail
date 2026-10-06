/** Operational errors with HTTP status; `errorHandler` maps these to JSON. */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  /** Machine-readable reason the client can act on (e.g. "ai_needs_key"). */
  public code?: string;
  /** Extra JSON the client may use — never secrets, never stack traces. */
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, opts: { code?: string; details?: Record<string, unknown> } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = opts.code;
    this.details = opts.details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input") {
    super(message, 400);
  }
}

export class AuthError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}
