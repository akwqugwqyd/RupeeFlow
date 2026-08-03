export const financeCategories = ["Food", "Travel", "Rent", "Bills", "Shopping", "Salary", "Other"] as const;
export const paymentMethods = ["UPI", "Card", "Cash", "Bank Transfer", "Wallet"] as const;

export function inferFinanceQuery(message: string, fallbackMonth: string) {
  const lower = message.toLowerCase();
  const category = financeCategories.find((item) => lower.includes(item.toLowerCase()));
  return {
    month: monthFromMessage(lower, fallbackMonth),
    category,
    type: /income|salary|earn(?:ed)?|deposit|credited/.test(lower) ? "income" as const : "expense" as const
  };
}

export function parseNaturalTransactionFallback(text: string, now = new Date()) {
  const amount = Number(text.match(/(?:₹|rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/i)?.[1]?.replaceAll(",", "") || 0);
  const lower = text.toLowerCase();
  const type = /salary|income|received|credited|refund/.test(lower) ? "income" as const : "expense" as const;
  const category = type === "income" ? "Salary"
    : /zomato|swiggy|food|restaurant|grocery|cafe/.test(lower) ? "Food"
      : /uber|ola|metro|travel|fuel|petrol|flight|train/.test(lower) ? "Travel"
        : /rent|landlord/.test(lower) ? "Rent"
          : /electric|power|internet|mobile|utility|bill/.test(lower) ? "Bills"
            : /amazon|flipkart|shopping|store/.test(lower) ? "Shopping"
              : "Other";
  const paymentMethod = /\bupi\b|gpay|phonepe|paytm/.test(lower) ? "UPI"
    : /cash|atm/.test(lower) ? "Cash"
      : /wallet/.test(lower) ? "Wallet"
        : /bank|neft|imps|rtgs|transfer/.test(lower) ? "Bank Transfer"
          : "Card";
  const date = relativeDate(lower, now);
  const merchant = extractMerchant(text) || "Unknown merchant";
  return {
    merchant,
    amount,
    category,
    type,
    paymentMethod,
    date,
    note: text.trim(),
    confidence: amount > 0 && merchant !== "Unknown merchant" ? "medium" as const : "low" as const,
    ambiguities: [
      ...(amount > 0 ? [] : ["Amount was not detected"]),
      ...(merchant !== "Unknown merchant" ? [] : ["Merchant was not detected"])
    ],
    mode: "rules" as const
  };
}

export function suggestedQuestions(intent?: string) {
  if (intent === "budget_status") return ["Which budget is most at risk?", "How much can I spend for the rest of this month?", "Compare this month with last month"];
  if (intent === "recent_transactions") return ["Show my food spending", "What were my largest expenses?", "Compare this month with last month"];
  if (intent === "monthly_compare") return ["What caused the change?", "Which category increased most?", "How are my budgets doing?"];
  return ["How much did I spend on food this month?", "Which budget is most at risk?", "What changed from last month?"];
}

function monthFromMessage(lower: string, fallbackMonth: string) {
  const explicit = lower.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (explicit) return `${explicit[1]}-${explicit[2]}`;
  if (lower.includes("last month")) {
    const [year, month] = fallbackMonth.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));
    return date.toISOString().slice(0, 7);
  }
  return fallbackMonth;
}

function relativeDate(lower: string, now: Date) {
  const date = new Date(now);
  if (lower.includes("yesterday")) date.setUTCDate(date.getUTCDate() - 1);
  const explicit = lower.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (explicit) return explicit[0];
  return date.toISOString().slice(0, 10);
}

function extractMerchant(text: string) {
  const withoutAmount = text
    .replace(/(?:₹|rs\.?\s*)?[\d,]+(?:\.\d{1,2})?/i, " ")
    .replace(/\b(?:paid|spent|received|got|for|using|via|through|on|today|yesterday|rupees?|inr|rs)\b/gi, " ")
    .replace(/\b(?:upi|card|cash|wallet|bank transfer|neft|imps|rtgs)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutAmount.slice(0, 120);
}
