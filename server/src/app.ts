import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { runRecurringTransactions } from "./services/recurring.service.js";
import { errorHandler, notFound } from "./middleware/error.js";
import aiRoutes from "./routes/ai.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import authRoutes from "./routes/auth.routes.js";
import billRoutes from "./routes/bill.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import goalRoutes from "./routes/goal.routes.js";
import insightRoutes from "./routes/insight.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";

dotenv.config();

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "rupeeflow-api" });
  });

  app.use(async (_req, _res, next) => {
    try {
      await runRecurringTransactions();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/goals", goalRoutes);
  app.use("/api/bills", billRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/insights", insightRoutes);
  app.use("/api/ai", aiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
