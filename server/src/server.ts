import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { connectDb } from "./config/db.js";
import { startRecurringJob } from "./jobs/recurring.job.js";
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

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "rupeeflow-api" });
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

connectDb().then(() => {
  startRecurringJob();
  app.listen(port, () => {
    console.log(`RupeeFlow API listening on port ${port}`);
  });
});
