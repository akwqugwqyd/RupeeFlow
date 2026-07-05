import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import { currentMonth, monthBounds } from "../utils/finance.js";
import { env } from "../config/env.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/monthly",
  validate(z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth()) }) })),
  async (req, res, next) => {
    try {
      const { month } = req.validated.query;
      const { start, end } = monthBounds(month);
      const [transactions, budgets] = await Promise.all([
        Transaction.find({ user: req.user._id, date: { $gte: start, $lt: end } }).lean(),
        Budget.find({ user: req.user._id, month }).lean()
      ]);

      const profile = buildProfile(transactions, budgets);
      if (!process.env.OPENAI_API_KEY) {
        return res.json({ source: "rules", insights: ruleBasedInsights(profile) });
      }

      if (!transactions.length) {
        return res.json({
          source: "rules",
          insights: [{ title: "Not enough data", detail: "Add transactions for this month to generate grounded insights.", severity: "medium" }],
          disclaimer: "Insights are based on tracked data and are not financial advice."
        });
      }
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 2 });
      const completion = await client.chat.completions.create({
        model: env().OPENAI_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: "Return concise JSON with an insights array using only the supplied aggregates. Never invent amounts, balances, or transactions. If evidence is insufficient, say so. This is not financial advice." },
          { role: "user", content: JSON.stringify({ month, profile }) }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(completion.choices[0].message.content);
      res.json({ source: "openai", insights: parsed.insights || [], disclaimer: "Insights are based on tracked data and are not financial advice." });
    } catch (error) {
      next(error);
    }
  }
);

function buildProfile(transactions, budgets) {
  const profile: any = { income: 0, expenses: 0, categories: {}, budgets: budgets.map((item) => ({ category: item.category, limit: item.limit })) };
  for (const tx of transactions) {
    if (tx.type === "income") profile.income += tx.amount;
    if (tx.type === "expense") {
      profile.expenses += tx.amount;
      profile.categories[tx.category] = (profile.categories[tx.category] || 0) + tx.amount;
    }
  }
  profile.net = profile.income - profile.expenses;
  profile.savingsRate = profile.income ? Math.round((profile.net / profile.income) * 100) : 0;
  return profile;
}

function ruleBasedInsights(profile) {
  const insights = [];
  if (profile.savingsRate < 10) {
    insights.push({ title: "Savings rate needs attention", detail: "Your net savings is below 10% this month. Review flexible categories and set one concrete reduction target.", severity: "high" });
  } else {
    insights.push({ title: "Positive savings momentum", detail: `Your estimated savings rate is ${profile.savingsRate}%. Keep protecting this gap before adding new recurring expenses.`, severity: "positive" });
  }

  const top = (Object.entries(profile.categories) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    insights.push({ title: `${top[0]} is your largest expense`, detail: `This category accounts for ${Math.round((top[1] / Math.max(profile.expenses, 1)) * 100)}% of tracked spending.`, severity: "medium" });
  }

  for (const budget of profile.budgets) {
    const spent = profile.categories[budget.category] || 0;
    if (spent > budget.limit) {
      insights.push({ title: `${budget.category} budget exceeded`, detail: `You are over by ${(spent - budget.limit).toFixed(2)}. Consider pausing discretionary spend here until next month.`, severity: "high" });
    }
  }

  return insights;
}

export default router;
