import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requestContext } from "./middleware/request.js";
import aiRoutes from "./routes/ai.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import authRoutes from "./routes/auth.routes.js";
import billRoutes from "./routes/bill.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import goalRoutes from "./routes/goal.routes.js";
import insightRoutes from "./routes/insight.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";

export function createApp() {
  const config = env();
  const app = express();
  const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(Boolean)
    .map((host) => `https://${host}`);
  const allowedOrigins = new Set([
    ...config.CLIENT_URL.split(",").map((origin) => origin.trim()).filter(Boolean),
    ...vercelOrigins
  ]);
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

  app.disable("x-powered-by");
  app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"]
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use(requestContext);
  app.use("/api", apiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "rupeeflow-api", timestamp: new Date().toISOString() });
  });
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/goals", goalRoutes);
  app.use("/api/bills", billRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/insights", insightRoutes);
  app.use("/api/ai", aiLimiter, aiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
