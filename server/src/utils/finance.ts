export const categories = [
  "Food",
  "Travel",
  "Rent",
  "Bills",
  "Shopping",
  "Salary",
  "Other",
  "Housing",
  "Transport",
  "Utilities",
  "Healthcare",
  "Insurance",
  "Debt",
  "Entertainment",
  "Income",
  "Savings"
];

export const defaultCategories = [
  { name: "Food", type: "expense", color: "#0e5b4f" },
  { name: "Travel", type: "expense", color: "#2563eb" },
  { name: "Rent", type: "expense", color: "#7c3aed" },
  { name: "Bills", type: "expense", color: "#b7791f" },
  { name: "Shopping", type: "expense", color: "#be123c" },
  { name: "Salary", type: "income", color: "#357a38" },
  { name: "Other", type: "both", color: "#657267" }
];

export function assertMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Month must be a valid YYYY-MM value");
  }
}

export function monthBounds(month: string) {
  assertMonth(month);
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return { start, end };
}

export function currentMonth(timeZone = "Asia/Kolkata", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number) {
  const { start } = monthBounds(month);
  start.setUTCMonth(start.getUTCMonth() + delta);
  return start.toISOString().slice(0, 7);
}

export function monthsEndingAt(month: string, count: number) {
  return Array.from({ length: count }, (_, index) => shiftMonth(month, index - count + 1));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function daysInMonth(month: string) {
  const { end } = monthBounds(month);
  return new Date(end.getTime() - 1).getUTCDate();
}

export function elapsedMonthRatio(month: string, now = new Date()) {
  const todayMonth = currentMonth("UTC", now);
  if (month < todayMonth) return 1;
  if (month > todayMonth) return 0;
  return Math.min(1, now.getUTCDate() / daysInMonth(month));
}

export function financialSummary(incomeValue: number, expenseValue: number) {
  const income = roundMoney(incomeValue);
  const expenses = roundMoney(expenseValue);
  const net = roundMoney(income - expenses);
  return {
    income,
    expenses,
    net,
    savingsRate: income > 0 ? Math.round((net / income) * 1000) / 10 : 0
  };
}

export function budgetMetrics(limit: number, spentValue: number, month: string, historicalAverage = 0, now = new Date()) {
  const spent = roundMoney(spentValue);
  const remaining = roundMoney(limit - spent);
  const percentUsed = Math.round((spent / limit) * 1000) / 10;
  const elapsed = elapsedMonthRatio(month, now);
  const projectedSpend = elapsed > 0 && elapsed < 1 ? roundMoney(spent / elapsed) : spent;
  const elapsedDays = Math.max(1, Math.round(daysInMonth(month) * elapsed));
  const status = spent > limit ? "over" : projectedSpend > limit ? "at_risk" : percentUsed >= 80 ? "near" : "healthy";
  return {
    spent,
    remaining,
    percentUsed,
    burnRatePerDay: roundMoney(spent / elapsedDays),
    projectedSpend,
    status,
    recommendedLimit: roundMoney(Math.max(historicalAverage, projectedSpend) * 1.05)
  };
}
