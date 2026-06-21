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
      const error: any = new Error(message);
      error.statusCode = 400;
      error.details = result.error.flatten();
      return next(error);
    }

    req.validated = result.data;
    next();
  };
}
