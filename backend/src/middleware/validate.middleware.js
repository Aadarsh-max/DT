// Validates req.body with a zod schema. ZodError is handled by error.middleware.js
export const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};