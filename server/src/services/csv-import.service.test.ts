import assert from "node:assert/strict";
import test from "node:test";
import { buildCsvCandidates, detectCsvMapping, parseCsvDocument, transactionFingerprint } from "./csv-import.service.js";

const categories = [
  { name: "Food", type: "expense" as const },
  { name: "Travel", type: "expense" as const },
  { name: "Rent", type: "expense" as const },
  { name: "Bills", type: "expense" as const },
  { name: "Shopping", type: "expense" as const },
  { name: "Other", type: "expense" as const },
  { name: "Salary", type: "income" as const }
];

test("CSV parser handles BOM, quoted commas, escaped quotes, and embedded newlines", () => {
  const parsed = parseCsvDocument('\uFEFFDate,Narration,Amount\r\n01/08/2026,"Cafe, Delhi",450\r\n02/08/2026,"A ""quoted""\nmerchant",125');
  assert.deepEqual(parsed.headers, ["Date", "Narration", "Amount"]);
  assert.equal(parsed.rows[0].Narration, "Cafe, Delhi");
  assert.equal(parsed.rows[1].Narration, 'A "quoted"\nmerchant');
});

test("CSV column detection recognizes common Indian bank statement headings", () => {
  const mapping = detectCsvMapping(["Transaction Date", "Narration", "Withdrawal Amt", "Deposit Amt", "Mode"]);
  assert.deepEqual(mapping, {
    date: "Transaction Date",
    merchant: "Narration",
    debit: "Withdrawal Amt",
    credit: "Deposit Amt",
    paymentMethod: "Mode"
  });
});

test("CSV candidates classify debit and credit rows and flag within-file duplicates", () => {
  const csv = [
    "Date,Narration,Withdrawal Amt,Deposit Amt",
    '01/08/2026,"UPI/ZOMATO, DELHI",450.50,',
    "02/08/2026,ACME PAYROLL,,150000",
    '01/08/2026,"UPI/ZOMATO, DELHI",450.50,'
  ].join("\n");
  const result = buildCsvCandidates(csv, undefined, categories);
  assert.equal(result.candidates[0].transaction?.type, "expense");
  assert.equal(result.candidates[0].transaction?.category, "Food");
  assert.equal(result.candidates[0].transaction?.paymentMethod, "UPI");
  assert.equal(result.candidates[1].transaction?.type, "income");
  assert.equal(result.candidates[1].transaction?.category, "Salary");
  assert.equal(result.candidates[2].duplicate, true);
  assert.equal(result.candidates[2].duplicateReason, "file");
});

test("CSV candidate builder uses explicit column mappings", () => {
  const csv = 'Posted,Details,Value,Direction\n2026-08-01,BigBasket,"1,299.25",debit';
  const result = buildCsvCandidates(csv, { date: "Posted", merchant: "Details", amount: "Value", type: "Direction" }, categories);
  assert.equal(result.candidates[0].transaction?.amount, 1299.25);
  assert.equal(result.candidates[0].transaction?.category, "Food");
});

test("CSV candidate builder reports invalid dates and amounts without committing partial values", () => {
  const csv = "Date,Narration,Amount\nnot-a-date,Unknown,-";
  const result = buildCsvCandidates(csv, undefined, categories);
  assert.equal(result.candidates[0].transaction, null);
  assert.deepEqual(result.candidates[0].errors, ["Invalid or missing date", "Invalid or missing amount"]);
});

test("transaction fingerprint is stable across merchant punctuation and Date representations", () => {
  const first = transactionFingerprint({ date: "2026-08-01", type: "expense", amount: 450, merchant: "Zomato, Delhi" });
  const second = transactionFingerprint({ date: new Date("2026-08-01T12:30:00Z"), type: "expense", amount: 450.001, merchant: "ZOMATO DELHI" });
  assert.equal(first, second);
});

test("CSV parser rejects unterminated quoted values", () => {
  assert.throws(() => parseCsvDocument('Date,Narration\n01/08/2026,"Broken'), /unterminated/);
});
