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
  "Shopping",
  "Income",
  "Savings",
  "Other"
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

export function monthBounds(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return { start, end };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
