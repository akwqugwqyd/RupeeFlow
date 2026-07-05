import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetMetrics,
  currentMonth,
  financialSummary,
  monthBounds,
  monthsEndingAt,
  percentChange
} from "./finance.js";

test("financial summary rounds currency and calculates savings deterministically", () => {
  assert.deepEqual(financialSummary(1000.005, 700.004), {
    income: 1000.01,
    expenses: 700,
    net: 300.01,
    savingsRate: 30
  });
  assert.equal(financialSummary(0, 500).savingsRate, 0);
});

test("month bounds reject impossible months and remain half-open", () => {
  assert.throws(() => monthBounds("2026-13"));
  const bounds = monthBounds("2024-02");
  assert.equal(bounds.start.toISOString(), "2024-02-01T00:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2024-03-01T00:00:00.000Z");
});

test("month series includes zero-activity periods in stable order", () => {
  assert.deepEqual(monthsEndingAt("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("current month respects the configured timezone at a UTC boundary", () => {
  const now = new Date("2026-01-31T19:00:00.000Z");
  assert.equal(currentMonth("Asia/Kolkata", now), "2026-02");
  assert.equal(currentMonth("UTC", now), "2026-01");
});

test("budget burn-rate marks projected overspend before the limit is reached", () => {
  const metrics = budgetMetrics(3_100, 2_000, "2026-01", 2_500, new Date("2026-01-10T12:00:00.000Z"));
  assert.equal(metrics.status, "at_risk");
  assert.equal(metrics.remaining, 1_100);
  assert.equal(metrics.projectedSpend, 6_200);
});

test("percentage change distinguishes missing baselines", () => {
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(120, 100), 20);
});
