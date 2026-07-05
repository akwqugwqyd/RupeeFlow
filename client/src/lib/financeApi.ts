import { api } from "./api";

export type DashboardOverview = {
  month: string;
  summary: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
    incomeChange: number | null;
    expenseChange: number | null;
    recurringExpenseImpact: number;
    recurringExpenseShare: number;
    budgetLimit: number;
    budgetSpent: number;
    overspentBudgets: number;
    atRiskBudgets: number;
  };
  categorySpend: Array<{ category: string; total: number; share: number }>;
  categoryTrends: Array<{ month: string; category: string; total: number }>;
  unusualSpending: Array<{ category: string; current: number; previousThreeMonthAverage: number; increasePercent: number | null }>;
  financialHealth: { score: number; status: string; factors: Record<string, unknown> };
  cashflow: Array<{ month: string; income: number; expenses: number; net: number }>;
  spendingTrend: Array<{ month: string; expenses: number }>;
  budgetUsage: Array<{
    _id: string;
    category: string;
    limit: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    projectedSpend: number;
    status: "healthy" | "near" | "at_risk" | "over";
  }>;
  upcomingRecurring: Array<{ _id: string; merchant?: string; category: string; amount: number; nextDate: string }>;
  recentTransactions: any[];
};

export async function getDashboard(month: string) {
  const [overview, summary, nudges] = await Promise.all([
    api.get<DashboardOverview>("/analytics/overview", { params: { month } }),
    api.get("/ai/monthly-summary", { params: { month } }),
    api.get("/ai/nudges")
  ]);
  return {
    overview: overview.data,
    summary: summary.data.paragraph as string,
    nudges: nudges.data.nudges || []
  };
}

export function apiMessage(error: any, fallback: string) {
  return error.response?.data?.error?.message || error.response?.data?.message || fallback;
}
