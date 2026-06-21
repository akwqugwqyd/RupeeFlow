import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Bill from "../models/Bill.js";
import Budget from "../models/Budget.js";
import Goal from "../models/Goal.js";
import Transaction from "../models/Transaction.js";
import { currentMonth, monthBounds } from "../utils/finance.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/overview",
  validate(z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth()) }) })),
  async (req, res, next) => {
    try {
      const { month } = req.validated.query;
      const { start, end } = monthBounds(month);
      const sixMonthsAgo = new Date(start);
      sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);

      const [monthlyTotals, categorySpend, cashflow, budgets, goals, bills, recent] = await Promise.all([
        Transaction.aggregate([
          { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
          { $group: { _id: "$type", total: { $sum: "$amount" } } }
        ]),
        Transaction.aggregate([
          { $match: { user: req.user._id, type: "expense", date: { $gte: start, $lt: end } } },
          { $group: { _id: "$category", total: { $sum: "$amount" } } },
          { $sort: { total: -1 } }
        ]),
        Transaction.aggregate([
          { $match: { user: req.user._id, date: { $gte: sixMonthsAgo, $lt: end } } },
          {
            $group: {
              _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, type: "$type" },
              total: { $sum: "$amount" }
            }
          },
          { $sort: { "_id.month": 1 } }
        ]),
        Budget.find({ user: req.user._id, month }).lean(),
        Goal.find({ user: req.user._id }).sort({ targetDate: 1 }).lean(),
        Bill.find({ user: req.user._id, status: "active" }).sort({ dueDay: 1 }).lean(),
        Transaction.find({ user: req.user._id }).sort({ date: -1, createdAt: -1 }).limit(8).lean()
      ]);

      const totals = Object.fromEntries(monthlyTotals.map((item) => [item._id, item.total]));
      const budgetLimit = budgets.reduce((sum, item) => sum + item.limit, 0);
      const billTotal = bills.reduce((sum, item) => sum + item.amount, 0);
      const cashflowRows = normalizeCashflow(cashflow);

      res.json({
        month,
        summary: {
          income: totals.income || 0,
          expenses: totals.expense || 0,
          net: (totals.income || 0) - (totals.expense || 0),
          savingsRate: totals.income ? Math.round((((totals.income || 0) - (totals.expense || 0)) / totals.income) * 100) : 0,
          budgetLimit,
          billTotal
        },
        categorySpend: categorySpend.map((item) => ({ category: item._id, total: item.total })),
        cashflow: cashflowRows,
        spendingTrend: cashflowRows.map((row) => ({ month: row.month, expenses: row.expenses })),
        goals,
        bills,
        recentTransactions: recent
      });
    } catch (error) {
      next(error);
    }
  }
);

function normalizeCashflow(rows) {
  const byMonth: Record<string, any> = {};
  for (const row of rows) {
    byMonth[row._id.month] ||= { month: row._id.month, income: 0, expenses: 0 };
    byMonth[row._id.month][row._id.type === "expense" ? "expenses" : "income"] = row.total;
  }
  return Object.values(byMonth).map((row: any) => ({ ...row, net: row.income - row.expenses }));
}

export default router;
