import assert from "node:assert/strict";
import test from "node:test";
import { inferFinanceQuery, parseNaturalTransactionFallback, suggestedQuestions } from "./ai-finance.service.js";

test("natural transaction fallback extracts common Indian expense descriptions", () => {
  const now = new Date("2026-08-03T12:00:00Z");
  const cases = [
    ["Paid ₹450 to Zomato via UPI yesterday", 450, "Food", "UPI", "expense", "2026-08-02"],
    ["Spent 1,200 on Uber using cash", 1200, "Travel", "Cash", "expense", "2026-08-03"],
    ["Received salary 150000 by bank transfer", 150000, "Salary", "Bank Transfer", "income", "2026-08-03"],
    ["Electricity bill 2400 paid by card", 2400, "Bills", "Card", "expense", "2026-08-03"],
    ["Paid rent 45000 through NEFT", 45000, "Rent", "Bank Transfer", "expense", "2026-08-03"],
    ["Bought shoes for 3200 at Amazon", 3200, "Shopping", "Card", "expense", "2026-08-03"]
  ] as const;

  for (const [input, amount, category, paymentMethod, type, date] of cases) {
    const parsed = parseNaturalTransactionFallback(input, now);
    assert.equal(parsed.amount, amount, input);
    assert.equal(parsed.category, category, input);
    assert.equal(parsed.paymentMethod, paymentMethod, input);
    assert.equal(parsed.type, type, input);
    assert.equal(parsed.date, date, input);
  }
});

test("natural transaction fallback reports missing critical fields", () => {
  const parsed = parseNaturalTransactionFallback("Bought something yesterday", new Date("2026-08-03T12:00:00Z"));
  assert.equal(parsed.amount, 0);
  assert.equal(parsed.confidence, "low");
  assert.ok(parsed.ambiguities.includes("Amount was not detected"));
});

test("finance query inference covers representative user questions", () => {
  const fallbackMonth = "2026-08";
  const cases: Array<[string, string | undefined, "income" | "expense", string]> = [
    ["How much did I spend on food?", "Food", "expense", "2026-08"],
    ["Show travel expenses", "Travel", "expense", "2026-08"],
    ["What was my rent?", "Rent", "expense", "2026-08"],
    ["How much went to bills?", "Bills", "expense", "2026-08"],
    ["Show shopping this month", "Shopping", "expense", "2026-08"],
    ["What salary did I receive?", "Salary", "income", "2026-08"],
    ["How much income was credited?", undefined, "income", "2026-08"],
    ["Show all expenses", undefined, "expense", "2026-08"],
    ["Food spending last month", "Food", "expense", "2026-07"],
    ["Income last month", undefined, "income", "2026-07"],
    ["Travel in 2025-12", "Travel", "expense", "2025-12"],
    ["Salary in 2026-01", "Salary", "income", "2026-01"],
    ["Other expenses", "Other", "expense", "2026-08"],
    ["Did my food spend increase?", "Food", "expense", "2026-08"],
    ["Deposits this month", undefined, "income", "2026-08"],
    ["What did I earn?", undefined, "income", "2026-08"],
    ["Show rent for 2026-06", "Rent", "expense", "2026-06"],
    ["Bills last month", "Bills", "expense", "2026-07"],
    ["Where did my money go?", undefined, "expense", "2026-08"],
    ["Compare shopping", "Shopping", "expense", "2026-08"]
  ];
  for (const [question, category, type, month] of cases) {
    assert.deepEqual(inferFinanceQuery(question, fallbackMonth), { month, category, type }, question);
  }
});

test("suggested questions are deterministic and contextual", () => {
  assert.equal(suggestedQuestions("budget_status").length, 3);
  assert.match(suggestedQuestions("monthly_compare")[0], /caused/i);
  assert.match(suggestedQuestions()[0], /food/i);
});
