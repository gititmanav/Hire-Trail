/** Parses `req.body` with Zod; replaces body with the parsed value (safe for downstream handlers). */
export function validate(schema) {
    return (req, _res, next) => {
        req.body = schema.parse(req.body);
        next();
    };
}
//# sourceMappingURL=validate.js.map