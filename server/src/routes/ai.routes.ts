import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import { monthBounds, currentMonth } from "../utils/finance.js";

const router = express.Router();
router.use(requireAuth);

router.post("/categorize", validate(z.object({ body: z.object({ text: z.string().min(2).max(200) }) })), async (req, res, next) => {
  try {
    const parsed = await parseTransactionText(req.validated.body.text);
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/chat",
  validate(z.object({ body: z.object({ message: z.string().min(2).max(500), history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1200) })).optional().default([]) }) })),
  async (req, res, next) => {
  try {
    const message = req.validated.body.message;
    const history = req.validated.body.history;
    const result = process.env.OPENAI_API_KEY
      ? await agenticFinanceAnswer(req.user._id, message, history)
      : await fallbackFinanceAnswer(req.user._id, message);
    res.json(result);
  } catch (error) {
    next(error);
  }
  }
);

router.get("/monthly-summary", validate(z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth()) }) })), async (req, res, next) => {
  try {
    const month = req.validated.query.month;
    const data = await monthlyComparison(req.user._id, month);
    const paragraph = await formatMonthlySummary(month, data);
    res.json({ paragraph, data });
  } catch (error) {
    next(error);
  }
});

router.get("/nudges", async (req, res, next) => {
  try {
    const month = currentMonth();
    const { start, end } = monthBounds(month);
    const latest = await Transaction.findOne({ user: req.user._id }).sort({ date: -1 });
    const daysSince = latest ? Math.floor((Date.now() - latest.date.getTime()) / 86400000) : null;
    const [budgets, spend] = await Promise.all([
      Budget.find({ user: req.user._id, month }).lean(),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "expense", date: { $gte: start, $lt: end } } },
        { $group: { _id: "$category", spent: { $sum: "$amount" } } }
      ])
    ]);
    const spendByCategory = Object.fromEntries(spend.map((item) => [item._id, item.spent]));
    const nudges = [];
    if (daysSince === null || daysSince >= 3) {
      nudges.push({ type: "stale_transactions", severity: "medium", message: "No transactions logged for 3+ days. Add recent spending to keep insights accurate." });
    }
    for (const budget of budgets) {
      const spent = spendByCategory[budget.category] || 0;
      if (spent >= budget.limit * 0.8) {
        nudges.push({
          type: "budget_threshold",
          severity: spent > budget.limit ? "high" : "medium",
          message: `${budget.category} is at ${Math.round((spent / Math.max(budget.limit, 1)) * 100)}% of this month's budget.`
        });
      }
    }
    res.json({ nudges });
  } catch (error) {
    next(error);
  }
});

async function parseTransactionText(text) {
  const fallback = () => {
    const amount = Number(text.match(/\d+(\.\d+)?/)?.[0] || 0);
    const lower = text.toLowerCase();
    const category: string = lower.includes("salary") ? "Salary" : lower.includes("zomato") || lower.includes("food") ? "Food" : lower.includes("uber") || lower.includes("travel") ? "Travel" : "Other";
    const merchant = text.replace(/\d+(\.\d+)?/g, "").trim() || "Unknown";
    return { merchant, amount, category, type: category === "Salary" ? "income" : "expense", paymentMethod: "Card", note: text };
  };

  if (!process.env.OPENAI_API_KEY) return fallback();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Extract a personal finance transaction. Return JSON: merchant, amount, category, type, paymentMethod, note. Categories: Food, Travel, Rent, Bills, Shopping, Salary, Other." },
      { role: "user", content: text }
    ]
  });
  return JSON.parse(completion.choices[0].message.content);
}

function inferFinanceQuery(message) {
  const lower = message.toLowerCase();
  const category = ["food", "travel", "rent", "bills", "shopping", "salary", "other"].find((item) => lower.includes(item));
  return {
    month: currentMonth(),
    category: category ? category[0].toUpperCase() + category.slice(1) : undefined,
    type: lower.includes("income") || lower.includes("salary") ? "income" : "expense"
  };
}

async function executeFinanceQuery(userId, query) {
  const { start, end } = monthBounds(query.month);
  const match: any = { user: userId, date: { $gte: start, $lt: end } };
  if (query.category) match.category = query.category;
  if (query.type) match.type = query.type;
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return { query, total, rows, chart: rows.map((row) => ({ label: row._id, value: row.total })) };
}

async function fallbackFinanceAnswer(userId, message) {
  const query = inferFinanceQuery(message);
  const data = await executeFinanceQuery(userId, query);
  return {
    answer: `For "${message}", I found ${data.rows.length} matching categories totaling ₹${data.total.toFixed(0)} this month.`,
    chart: data.chart,
    rows: data.rows,
    mode: "rules"
  };
}

async function agenticFinanceAnswer(userId, message, history = []) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "query_finance_data",
        description: "Safely query this user's personal finance data. Use this before answering money questions.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            intent: {
              type: "string",
              enum: ["overview", "category_spend", "budget_status", "recent_transactions", "monthly_compare"],
              description: "The kind of finance analysis needed."
            },
            month: { type: "string", description: "Month in YYYY-MM. Defaults to current month." },
            category: { type: "string", description: "Optional category like Food, Travel, Rent, Bills, Shopping, Salary, Other." },
            type: { type: "string", enum: ["income", "expense"], description: "Optional transaction type." },
            limit: { type: "number", description: "Maximum rows for recent transaction queries." }
          },
          required: ["intent"]
        }
      }
    }
  ];

  const planning = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    tools,
    tool_choice: "auto",
    messages: [
      {
        role: "system",
        content:
          "You are RupeeFlow's agentic finance assistant for an Indian personal finance app. Ask for data using the available tool before answering questions about spending, income, budgets, trends, or transactions. Never invent numbers. Currency is INR. Give practical, specific, non-investment-advice guidance."
      },
      ...history.slice(-8).map((item) => ({ role: item.role, content: item.text })),
      { role: "user", content: message }
    ]
  });

  const assistantMessage = planning.choices[0].message;
  const toolCalls = assistantMessage.tool_calls || [];
  const toolResults = [];

  if (!toolCalls.length) {
    const defaultData = await executeFinanceTool(userId, { intent: "overview", month: currentMonth() });
    toolResults.push({ toolCallId: "fallback", name: "query_finance_data", data: defaultData });
  }

  for (const toolCall of toolCalls) {
    const functionCall = (toolCall as any).function;
    if (functionCall?.name !== "query_finance_data") continue;
    const args = JSON.parse(functionCall.arguments || "{}");
    const data = await executeFinanceTool(userId, args);
    toolResults.push({ toolCallId: toolCall.id, name: functionCall.name, data });
  }

  const finalMessages: any[] = [
    {
      role: "system",
      content:
        "Return JSON only with keys: answer, chartTitle, chart. answer should be concise but useful, with 1-3 concrete observations or next actions. chart must be an array of {label,value} when useful, otherwise []. Use INR formatting in text."
    },
    ...history.slice(-8).map((item) => ({ role: item.role, content: item.text })),
    { role: "user", content: message },
    {
      role: "assistant",
      content:
        "I queried the user's finance database. Use only this tool data to answer: " +
        JSON.stringify(toolResults.map((result) => result.data))
    }
  ];

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: finalMessages
  });

  const parsed = safeJson(completion.choices[0].message.content || "{}");
  const primaryData = toolResults[0]?.data;
  return {
    answer: parsed.answer || "I checked your finance data, but could not produce a confident answer.",
    chartTitle: parsed.chartTitle || primaryData?.chartTitle || "",
    chart: Array.isArray(parsed.chart) && parsed.chart.length ? parsed.chart : primaryData?.chart || [],
    rows: primaryData?.rows || [],
    mode: "openai",
    tool: primaryData?.intent
  };
}

async function executeFinanceTool(userId, args) {
  const month = args.month && /^\d{4}-\d{2}$/.test(args.month) ? args.month : currentMonth();
  const { start, end } = monthBounds(month);
  const baseMatch: any = { user: userId, date: { $gte: start, $lt: end } };
  if (args.category) baseMatch.category = new RegExp(`^${escapeRegExp(args.category)}$`, "i");
  if (args.type) baseMatch.type = args.type;

  if (args.intent === "recent_transactions") {
    const rows = await Transaction.find(baseMatch)
      .sort({ date: -1, createdAt: -1 })
      .limit(Math.min(Number(args.limit) || 8, 20))
      .lean();
    return {
      intent: args.intent,
      month,
      rows,
      chartTitle: "Recent transactions",
      chart: rows.map((row) => ({ label: row.merchant || row.category, value: row.amount }))
    };
  }

  if (args.intent === "budget_status") {
    const [budgets, spend] = await Promise.all([
      Budget.find({ user: userId, month }).lean(),
      Transaction.aggregate([
        { $match: { user: userId, type: "expense", date: { $gte: start, $lt: end } } },
        { $group: { _id: "$category", spent: { $sum: "$amount" } } },
        { $sort: { spent: -1 } }
      ])
    ]);
    const spendByCategory = Object.fromEntries(spend.map((item) => [item._id, item.spent]));
    const rows = budgets.map((budget) => ({
      category: budget.category,
      limit: budget.limit,
      spent: spendByCategory[budget.category] || 0,
      remaining: budget.limit - (spendByCategory[budget.category] || 0),
      percentUsed: Math.round(((spendByCategory[budget.category] || 0) / Math.max(budget.limit, 1)) * 100)
    }));
    return {
      intent: args.intent,
      month,
      rows,
      chartTitle: "Budget usage",
      chart: rows.map((row) => ({ label: row.category, value: row.spent }))
    };
  }

  if (args.intent === "monthly_compare") {
    const comparison = await monthlyComparison(userId, month);
    return {
      intent: args.intent,
      month,
      rows: comparison,
      chartTitle: "This month vs last month",
      chart: [
        { label: "Current expenses", value: comparison.current.expense || 0 },
        { label: "Previous expenses", value: comparison.previous.expense || 0 },
        { label: "Current income", value: comparison.current.income || 0 },
        { label: "Previous income", value: comparison.previous.income || 0 }
      ]
    };
  }

  const groupByCategory = args.intent === "category_spend" || args.category;
  const rows = await Transaction.aggregate([
    { $match: baseMatch },
    { $group: { _id: groupByCategory ? "$category" : "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    intent: args.intent || "overview",
    month,
    total,
    rows,
    chartTitle: groupByCategory ? "Category breakdown" : "Income vs expenses",
    chart: rows.map((row) => ({ label: row._id, value: row.total }))
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function monthlyComparison(userId, month) {
  const current = monthBounds(month);
  const previousMonthDate = new Date(current.start);
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previous = monthBounds(previousMonthDate.toISOString().slice(0, 7));
  const aggregate = (bounds) =>
    Transaction.aggregate([
      { $match: { user: userId, date: { $gte: bounds.start, $lt: bounds.end } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } }
    ]);
  const [cur, prev] = await Promise.all([aggregate(current), aggregate(previous)]);
  return { current: Object.fromEntries(cur.map((x) => [x._id, x.total])), previous: Object.fromEntries(prev.map((x) => [x._id, x.total])) };
}

async function formatMonthlySummary(month, data) {
  const curExpense = data.current.expense || 0;
  const prevExpense = data.previous.expense || 0;
  const diff = curExpense - prevExpense;
  if (!process.env.OPENAI_API_KEY) {
    return `In ${month}, you spent ${curExpense.toFixed(2)}. That is ${Math.abs(diff).toFixed(2)} ${diff >= 0 ? "more" : "less"} than last month.`;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: "Write one friendly monthly finance insight paragraph from the JSON data." },
      { role: "user", content: JSON.stringify({ month, data }) }
    ]
  });
  return completion.choices[0].message.content;
}

export default router;
