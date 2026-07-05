import assert from "node:assert/strict";
import test from "node:test";
import { dueOccurrences, nextOccurrence } from "./recurring.service.js";

test("monthly recurrence clamps end-of-month dates without drifting", () => {
  const template = { date: new Date("2024-01-31T00:00:00.000Z"), recurringFrequency: "monthly", recurringAnchorDay: 31 };
  assert.deepEqual(
    dueOccurrences(template, new Date("2024-04-30T23:00:00.000Z")).map((date) => date.toISOString().slice(0, 10)),
    ["2024-02-29", "2024-03-31", "2024-04-30"]
  );
});

test("yearly recurrence handles leap-day anchors", () => {
  const template = { date: new Date("2024-02-29T00:00:00.000Z"), recurringFrequency: "yearly", recurringAnchorDay: 29 };
  assert.deepEqual(
    dueOccurrences(template, new Date("2027-03-01T00:00:00.000Z")).map((date) => date.toISOString().slice(0, 10)),
    ["2025-02-28", "2026-02-28", "2027-02-28"]
  );
});

test("next occurrence skips already elapsed schedule dates", () => {
  const template = { date: new Date("2026-01-15T00:00:00.000Z"), recurringFrequency: "monthly", recurringAnchorDay: 15 };
  assert.equal(nextOccurrence(template, new Date("2026-03-20T00:00:00.000Z"))?.toISOString().slice(0, 10), "2026-04-15");
});
