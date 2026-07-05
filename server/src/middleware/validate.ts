import { AppError } from "../utils/errors.js";

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.filter((part) => part !== "body").join(".");
      const message = field ? `${field}: ${firstIssue.message}` : "Validation failed";
      return next(new AppError(message, 400, "VALIDATION_ERROR", result.error.flatten()));
    }

    req.validated = result.data;
    next();
  };
}
