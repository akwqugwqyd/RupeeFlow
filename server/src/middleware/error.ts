import { logger } from "../utils/logger.js";

export function notFound(req, _res, next) {
  const error: any = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = "ROUTE_NOT_FOUND";
  next(error);
}

export function errorHandler(error, req, res, _next) {
  let statusCode = error.statusCode || 500;
  if (error.name === "ValidationError" || error.name === "CastError") statusCode = 400;
  if (error.code === 11000) statusCode = 409;
  const publicMessage = statusCode >= 500 && process.env.NODE_ENV === "production"
    ? "Unexpected server error"
    : error.message || "Unexpected server error";
  logger.error("request.failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl?.split("?")[0],
    statusCode,
    errorName: error.name,
    errorCode: error.code,
    message: error.message
  });
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
      message: publicMessage,
      details: statusCode >= 500 ? undefined : error.details
    },
    message: publicMessage,
    requestId: req.requestId
  });
}
