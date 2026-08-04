import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

export function requestContext(req, res, next) {
  const requestId = String(req.headers["x-request-id"] || randomUUID());
  const startedAt = performance.now();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    logger.info("request.completed", {
      requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    });
  });
  next();
}
