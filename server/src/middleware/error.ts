export function notFound(req, _res, next) {
  const error: any = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || "Unexpected server error",
    details: error.details,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}
