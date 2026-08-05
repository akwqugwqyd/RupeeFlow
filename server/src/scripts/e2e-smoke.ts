import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const configuredUri = process.env.MONGODB_URI;
if (!configuredUri) throw new Error("MONGODB_URI is required for the isolated end-to-end smoke test");

const databaseName = `rupeeflow_e2e_${Date.now()}`;
const testUri = new URL(configuredUri);
testUri.pathname = `/${databaseName}`;
process.env.MONGODB_URI = testUri.toString();
delete process.env.OPENAI_API_KEY;

const [{ createApp }, { connectDb, disconnectDb }] = await Promise.all([
  import("../app.js"),
  import("../config/db.js")
]);

await connectDb();
assert.equal(mongoose.connection.name, databaseName, "Smoke test must only use its isolated database");
const server = createApp().listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not determine smoke-test server port");
const baseUrl = `http://127.0.0.1:${address.port}/api`;
let sessionCookie = "";

try {
  const registration = await request("/auth/register", {
    method: "POST",
    body: { name: "E2E User", email: `e2e-${Date.now()}@rupeeflow.test`, password: "test-password-123", monthlyIncomeTarget: 100000 }
  });
  assert.ok(registration.user);
  assert.ok(sessionCookie);

  const suggestion = await request("/ai/categorize", {
    method: "POST",
    body: { text: "Paid ₹450 to Zomato via UPI yesterday" }
  });
  assert.equal(suggestion.amount, 450);
  assert.equal(suggestion.category, "Food");
  assert.equal(suggestion.paymentMethod, "UPI");

  const month = new Date().toISOString().slice(0, 7);
  const csv = [
    "Date,Narration,Withdrawal Amt,Deposit Amt",
    `${month}-01,Zomato UPI,450,`,
    `${month}-02,ACME PAYROLL,,100000`,
    `${month}-01,Zomato UPI,450,`
  ].join("\n");
  const preview = await request("/transactions/import/preview", { method: "POST", body: { csv } });
  assert.equal(preview.summary.ready, 2);
  assert.equal(preview.summary.duplicates, 1);

  const transactions = preview.candidates
    .filter((candidate) => candidate.transaction && !candidate.duplicate && !candidate.errors.length)
    .map((candidate) => candidate.transaction);
  const committed = await request("/transactions/import/commit", { method: "POST", body: { transactions } });
  assert.equal(committed.imported, 2);

  const listing = await request("/transactions?limit=20", { method: "GET" });
  assert.equal(listing.total, 2);

  const chat = await request("/ai/chat", { method: "POST", body: { message: "How much did I spend on food this month?", history: [] } });
  assert.match(chat.answer, /450/);
  assert.ok(chat.evidence.some((item) => item.kind === "transaction" && item.transactionId));
  assert.ok(chat.calculations.length > 0);
  assert.equal(chat.confidence, "high");

  console.log("E2E smoke test passed: auth → natural entry → CSV preview/import → grounded AI evidence");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(mongoose.connection.name, databaseName, "Refusing to clean up a non-test database");
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

async function request(path: string, options: { method: string; body?: unknown }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(sessionCookie ? { Cookie: sessionCookie } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) sessionCookie = setCookie.split(";")[0];
  const data = await response.json();
  assert.ok(response.ok, `${options.method} ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
