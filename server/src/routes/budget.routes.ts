import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import { budgetMetrics, currentMonth, monthBounds, roundMoney, shiftMonth } from "../utils/finance.js";

const router = express.Router();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const body = z.object({ category: z.string().min(1), limit: z.coerce.number().positive(), month: monthSchema });

router.use(requireAuth);

router.get("/", validate(z.object({ query: z.object({ month: monthSchema.default(currentMonth()) }) })), async (req, res, next) => {
  try {
    const { month } = req.validated.query;
    const { start, end } = monthBounds(month);
    const historyStart = monthBounds(shiftMonth(month, -3)).start;
    const [budgets, spend, history] = await Promise.all([
      Budget.find({ user: req.user._id, month }).sort({ category: 1 }).lean(),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "expense", date: { $gte: start, $lt: end } } },
        { $group: { _id: "$category", spent: { $sum: "$amount" } } }
      ]),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "expense", date: { $gte: historyStart, $lt: start } } },
        { $group: { _id: "$category", average: { $avg: "$amount" }, total: { $sum: "$amount" } } }
      ])
    ]);
    const spentByCategory = Object.fromEntries(spend.map((item) => [item._id, item.spent]));
    const historicalByCategory = Object.fromEntries(history.map((item) => [item._id, item.total / 3]));
    res.json(budgets.map((budget) => {
      const metrics = budgetMetrics(budget.limit, spentByCategory[budget.category] || 0, month, historicalByCategory[budget.category] || 0);
      return {
        ...budget,
        ...metrics,
        previousThreeMonthAverage: roundMoney(historicalByCategory[budget.category] || 0),
        suggestedLimit: metrics.recommendedLimit,
        alert: metrics.status !== "healthy"
      };
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(z.object({ body })), async (req, res, next) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category: req.validated.body.category, month: req.validated.body.month },
      { ...req.validated.body, user: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(budget);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate(z.object({ params: z.object({ id: z.string().min(1) }) })), async (req, res, next) => {
  try {
    const deleted = await Budget.findOneAndDelete({ _id: req.validated.params.id, user: req.user._id });
    if (!deleted) return res.status(404).json({ message: "Budget not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
