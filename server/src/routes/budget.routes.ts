import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import { currentMonth, monthBounds } from "../utils/finance.js";

const router = express.Router();
const body = z.object({ category: z.string().min(1), limit: z.coerce.number().positive(), month: z.string().regex(/^\d{4}-\d{2}$/) });

router.use(requireAuth);

router.get("/", validate(z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth()) }) })), async (req, res, next) => {
  try {
    const { month } = req.validated.query;
    const { start, end } = monthBounds(month);
    const [budgets, spend] = await Promise.all([
      Budget.find({ user: req.user._id, month }).sort({ category: 1 }).lean(),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "expense", date: { $gte: start, $lt: end } } },
        { $group: { _id: "$category", spent: { $sum: "$amount" } } }
      ])
    ]);
    const spentByCategory = Object.fromEntries(spend.map((item) => [item._id, item.spent]));
    res.json(budgets.map((budget) => {
      const spent = spentByCategory[budget.category] || 0;
      return { ...budget, spent, percentUsed: Math.round((spent / Math.max(budget.limit, 1)) * 100), alert: spent >= budget.limit * 0.8 };
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
    await Budget.findOneAndDelete({ _id: req.validated.params.id, user: req.user._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
