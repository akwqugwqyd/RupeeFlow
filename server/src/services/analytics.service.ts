import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import {
  budgetMetrics,
  financialSummary,
  monthBounds,
  monthsEndingAt,
  percentChange,
  roundMoney,
  shiftMonth
} from "../utils/finance.js";

type Totals = { income: number; expenses: number; net: number; savingsRate: number };

function totalsFromRows(rows: Array<{ _id: string; total: number }>): Totals {
  const map = Object.fromEntries(rows.map((row) => [row._id, roundMoney(row.total)]));
  return financialSummary(map.income || 0, map.expense || 0);
}

async function totalsForMonth(userId, month: string) {
  const { start, end } = monthBounds(month);
  const rows = await Transaction.aggregate([
    { $match: { user: userId, date: { $gte: start, $lt: end } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } }
  ]);
  // Recurring templates are schedules, not booked cash flow. Generated entries remain included.
  return totalsFromRows(rows);
}

export async function buildOverview(userId, month: string, now = new Date()) {
  const { start, end } = monthBounds(month);
  const trendMonths = monthsEndingAt(month, 6);
  const trendStart = monthBounds(trendMonths[0]).start;
  const previousMonth = shiftMonth(month, -1);
  const priorThreeStart = monthBounds(shiftMonth(month, -3)).start;

  const [currentTotals, previousTotals, categoryRows, trendRows, categoryTrendRows, budgets, historicalCategoryRows] = await Promise.all([
    totalsForMonth(userId, month),
    totalsForMonth(userId, previousMonth),
    Transaction.aggregate([
      { $match: { user: userId, type: "expense", date: { $gte: start, $lt: end } } },
      { $group: { _id: "$category", total: { $sum: "$amount" }, recurring: { $sum: { $cond: [{ $or: ["$isRecurring", { $ifNull: ["$generationKey", false] }] }, "$amount", 0] } } } },
      { $sort: { total: -1, _id: 1 } }
    ]),
    Transaction.aggregate([
      { $match: { user: userId, date: { $gte: trendStart, $lt: end } } },
      { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, type: "$type" }, total: { $sum: "$amount" } } },
      { $sort: { "_id.month": 1, "_id.type": 1 } }
    ]),
    Transaction.aggregate([
      { $match: { user: userId, type: "expense", date: { $gte: trendStart, $lt: end } } },
      { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, category: "$category" }, total: { $sum: "$amount" } } },
      { $sort: { "_id.month": 1, total: -1, "_id.category": 1 } }
    ]),
    Budget.find({ user: userId, month }).sort({ category: 1 }).lean(),
    Transaction.aggregate([
      { $match: { user: userId, type: "expense", date: { $gte: priorThreeStart, $lt: start } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } }
    ])
  ]);

  const trendMap = new Map<string, { month: string; income: number; expenses: number }>(
    trendMonths.map((value) => [value, { month: value, income: 0, expenses: 0 }])
  );
  for (const row of trendRows) {
    const target = trendMap.get(row._id.month);
    if (target) target[row._id.type === "expense" ? "expenses" : "income"] = roundMoney(row.total);
  }
  const cashflow = [...trendMap.values()].map((row) => ({ ...row, net: roundMoney(row.income - row.expenses) }));
  const spentByCategory = Object.fromEntries(categoryRows.map((row) => [row._id, roundMoney(row.total)]));
  const historicalByCategory = Object.fromEntries(historicalCategoryRows.map((row) => [row._id, roundMoney(row.total / 3)]));
  const budgetUsage = budgets.map((budget) => {
    const metrics = budgetMetrics(budget.limit, spentByCategory[budget.category] || 0, month, historicalByCategory[budget.category] || 0, now);
    return {
      ...budget,
      ...metrics
    };
  });
  const recurringExpenseImpact = roundMoney(categoryRows.reduce((sum, row) => sum + (row.recurring || 0), 0));
  const unusualSpending = categoryRows
    .map((row) => {
      const average = historicalByCategory[row._id] || 0;
      return {
        category: row._id,
        current: roundMoney(row.total),
        previousThreeMonthAverage: roundMoney(average),
        increasePercent: average > 0 ? percentChange(row.total, average) : null
      };
    })
    .filter((row) => row.previousThreeMonthAverage > 0 && row.current > row.previousThreeMonthAverage * 1.5)
    .sort((a, b) => b.current - b.current);
  const healthDeductions = [
    currentTotals.net < 0 ? 30 : 0,
    currentTotals.income > 0 && currentTotals.savingsRate < 10 ? 20 : 0,
    Math.min(30, budgetUsage.filter((budget) => budget.status === "over").length * 10),
    unusualSpending.length ? 10 : 0
  ].reduce((sum, value) => sum + value, 0);
  const healthScore = Math.max(0, 100 - healthDeductions);

  return {
    month,
    summary: {
      ...currentTotals,
      incomeChange: percentChange(currentTotals.income, previousTotals.income),
      expenseChange: percentChange(currentTotals.expenses, previousTotals.expenses),
      netChange: roundMoney(currentTotals.net - previousTotals.net),
      recurringExpenseImpact,
      recurringExpenseShare: currentTotals.expenses ? Math.round((recurringExpenseImpact / currentTotals.expenses) * 1000) / 10 : 0,
      budgetLimit: roundMoney(budgets.reduce((sum, budget) => sum + budget.limit, 0)),
      budgetSpent: roundMoney(budgetUsage.reduce((sum, budget) => sum + budget.spent, 0)),
      overspentBudgets: budgetUsage.filter((budget) => budget.status === "over").length,
      atRiskBudgets: budgetUsage.filter((budget) => budget.status === "at_risk" || budget.status === "near").length
    },
    previous: previousTotals,
    categorySpend: categoryRows.map((row) => ({
      category: row._id,
      total: roundMoney(row.total),
      share: currentTotals.expenses ? Math.round((row.total / currentTotals.expenses) * 1000) / 10 : 0
    })),
    categoryTrends: categoryTrendRows.map((row) => ({
      month: row._id.month,
      category: row._id.category,
      total: roundMoney(row.total)
    })),
    unusualSpending,
    financialHealth: {
      score: healthScore,
      status: healthScore >= 80 ? "strong" : healthScore >= 60 ? "watch" : "needs_attention",
      factors: {
        positiveCashFlow: currentTotals.net >= 0,
        savingsRate: currentTotals.savingsRate,
        overspentBudgets: budgetUsage.filter((budget) => budget.status === "over").length,
        unusualCategories: unusualSpending.length
      }
    },
    cashflow,
    spendingTrend: cashflow.map((row) => ({ month: row.month, expenses: row.expenses })),
    budgetUsage
  };
}

export async function buildReport(userId, startDate: Date, endDate: Date, granularity: "month" | "quarter" | "year") {
  const periodExpression: any = granularity === "quarter"
    ? {
        $concat: [
          { $dateToString: { format: "%Y", date: "$date", timezone: "UTC" } },
          "-Q",
          { $toString: { $ceil: { $divide: [{ $month: "$date" }, 3] } } }
        ]
      }
    : { $dateToString: { format: granularity === "year" ? "%Y" : "%Y-%m", date: "$date", timezone: "UTC" } };
  const rows = await Transaction.aggregate([
    { $match: { user: userId, date: { $gte: startDate, $lt: endDate } } },
    { $group: { _id: { period: periodExpression, type: "$type" }, total: { $sum: "$amount" } } },
    { $sort: { "_id.period": 1, "_id.type": 1 } }
  ]);
  const periods: Record<string, { period: string; income: number; expenses: number; net: number; savingsRate: number }> = {};
  for (const row of rows) {
    periods[row._id.period] ||= { period: row._id.period, income: 0, expenses: 0, net: 0, savingsRate: 0 };
    periods[row._id.period][row._id.type === "expense" ? "expenses" : "income"] = roundMoney(row.total);
  }
  return Object.values(periods).map((period) => {
    period.net = roundMoney(period.income - period.expenses);
    period.savingsRate = period.income ? Math.round((period.net / period.income) * 1000) / 10 : 0;
    return period;
  });
}
