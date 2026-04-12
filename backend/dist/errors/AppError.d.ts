/** Operational errors with HTTP status; `errorHandler` maps these to JSON. */
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ValidationError extends AppError {
    constructor(message?: string);
}
export declare class AuthError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
