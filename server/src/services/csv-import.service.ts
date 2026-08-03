import { createHash } from "node:crypto";

export type CsvMapping = {
  date?: string;
  merchant?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
  category?: string;
  paymentMethod?: string;
  note?: string;
};

export type ImportedTransaction = {
  type: "income" | "expense";
  amount: number;
  category: string;
  merchant: string;
  note: string;
  date: string;
  paymentMethod: string;
};

export type CsvCandidate = {
  rowNumber: number;
  transaction: ImportedTransaction | null;
  fingerprint: string | null;
  errors: string[];
  duplicate: boolean;
  duplicateReason?: "file" | "account";
};

const headerMatchers: Record<keyof CsvMapping, RegExp[]> = {
  date: [/^date$/, /transaction.*date/, /value.*date/, /posted.*date/],
  merchant: [/merchant/, /narration/, /description/, /transaction.*details?/, /particulars?/, /payee/],
  amount: [/^amount$/, /transaction.*amount/, /txn.*amount/],
  debit: [/debit/, /withdrawal/, /money.*out/],
  credit: [/credit/, /deposit/, /money.*in/],
  type: [/^type$/, /transaction.*type/, /^dr\/?cr$/],
  category: [/category/],
  paymentMethod: [/payment.*method/, /^mode$/, /channel/],
  note: [/^note$/, /remarks?/, /memo/]
};

export function parseCsvDocument(input: string) {
  const text = input.replace(/^\uFEFF/, "");
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) matrix.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) matrix.push(row);
  if (matrix.length < 2) throw new Error("CSV must contain a header and at least one data row");

  const headers = matrix[0].map((header, index) => header || `Column ${index + 1}`);
  if (new Set(headers.map(normalizeHeader)).size !== headers.length) {
    throw new Error("CSV headers must be unique");
  }
  const rows = matrix.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
  );
  return { headers, rows };
}

export function detectCsvMapping(headers: string[]): CsvMapping {
  const mapping: CsvMapping = {};
  for (const key of Object.keys(headerMatchers) as Array<keyof CsvMapping>) {
    const header = headers.find((candidate) => headerMatchers[key].some((matcher) => matcher.test(normalizeHeader(candidate))));
    if (header) mapping[key] = header;
  }
  return mapping;
}

export function buildCsvCandidates(
  input: string,
  suppliedMapping: CsvMapping | undefined,
  categories: Array<{ name: string; type: "income" | "expense" | "both" }>
) {
  const { headers, rows } = parseCsvDocument(input);
  const mapping = suppliedMapping ? removeBlankMappings(suppliedMapping) : detectCsvMapping(headers);
  validateMapping(mapping, headers);
  const seen = new Set<string>();
  const candidates = rows.slice(0, 500).map((row, index): CsvCandidate => {
    const errors: string[] = [];
    const date = parseStatementDate(value(row, mapping.date));
    if (!date) errors.push("Invalid or missing date");

    const debit = parseAmount(value(row, mapping.debit));
    const credit = parseAmount(value(row, mapping.credit));
    const rawAmount = parseAmount(value(row, mapping.amount));
    const rawType = value(row, mapping.type).toLowerCase();
    const type = inferType(rawType, debit, credit, rawAmount);
    const amount = mapping.amount ? Math.abs(rawAmount || 0) : type === "income" ? credit : debit;
    if (!amount || amount <= 0) errors.push("Invalid or missing amount");

    const rawMerchant = value(row, mapping.merchant) || value(row, mapping.note);
    const merchant = cleanText(rawMerchant || "Imported transaction", 120);
    const category = selectCategory(value(row, mapping.category), merchant, type, categories);
    if (!category) errors.push(`No ${type} category is available`);
    const paymentMethod = cleanText(value(row, mapping.paymentMethod) || inferPaymentMethod(rawMerchant), 50);
    const note = cleanText(value(row, mapping.note) || "Imported from CSV", 500);

    if (errors.length || !date || !category || !amount) {
      return { rowNumber: index + 2, transaction: null, fingerprint: null, errors, duplicate: false };
    }

    const transaction: ImportedTransaction = {
      type,
      amount: roundMoney(amount),
      category,
      merchant,
      note,
      date,
      paymentMethod
    };
    const fingerprint = transactionFingerprint(transaction);
    const duplicate = seen.has(fingerprint);
    seen.add(fingerprint);
    return {
      rowNumber: index + 2,
      transaction,
      fingerprint,
      errors,
      duplicate,
      ...(duplicate && { duplicateReason: "file" as const })
    };
  });

  return { headers, mapping, candidates, truncated: rows.length > 500 };
}

export function transactionFingerprint(transaction: { date: string | Date; type: string; amount: number; merchant: string }) {
  const date = new Date(transaction.date).toISOString().slice(0, 10);
  const merchant = transaction.merchant.toLowerCase().replace(/[^a-z0-9]/g, "");
  return createHash("sha256")
    .update(`${date}|${transaction.type}|${roundMoney(transaction.amount).toFixed(2)}|${merchant}`)
    .digest("hex");
}

function validateMapping(mapping: CsvMapping, headers: string[]) {
  if (!mapping.date) throw new Error("Map a date column");
  if (!mapping.merchant && !mapping.note) throw new Error("Map a merchant, description, narration, or note column");
  if (!mapping.amount && !mapping.debit && !mapping.credit) {
    throw new Error("Map an amount column or debit/credit columns");
  }
  for (const selected of Object.values(mapping)) {
    if (selected && !headers.includes(selected)) throw new Error(`Mapped column does not exist: ${selected}`);
  }
}

function inferType(rawType: string, debit: number, credit: number, amount: number): "income" | "expense" {
  if (/income|credit|deposit|\bcr\b/.test(rawType)) return "income";
  if (/expense|debit|withdraw|\bdr\b/.test(rawType)) return "expense";
  if (credit > 0 && debit <= 0) return "income";
  if (debit > 0) return "expense";
  return amount < 0 ? "expense" : "expense";
}

function selectCategory(
  rawCategory: string,
  merchant: string,
  type: "income" | "expense",
  categories: Array<{ name: string; type: "income" | "expense" | "both" }>
) {
  const eligible = categories.filter((category) => category.type === type || category.type === "both");
  const exact = eligible.find((category) => category.name.toLowerCase() === rawCategory.trim().toLowerCase());
  if (exact) return exact.name;

  const lower = merchant.toLowerCase();
  const preferred = type === "income" ? "Salary"
    : /zomato|swiggy|bigbasket|restaurant|food|grocery|cafe/.test(lower) ? "Food"
      : /uber|ola|metro|fuel|petrol|travel|flight|railway/.test(lower) ? "Travel"
        : /rent|landlord/.test(lower) ? "Rent"
          : /electric|power|internet|broadband|mobile|utility|bill/.test(lower) ? "Bills"
            : /amazon|flipkart|shopping|store/.test(lower) ? "Shopping"
              : "Other";
  return eligible.find((category) => category.name.toLowerCase() === preferred.toLowerCase())?.name || eligible[0]?.name;
}

function parseStatementDate(raw: string) {
  const text = raw.trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return isoDate(year, Number(match[2]), Number(match[1]));
  }
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseAmount(raw: string) {
  const text = raw.trim();
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const parsed = Number(text.replace(/[₹,$\s()]/g, "").replace(/\b(?:cr|dr)\b/gi, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function inferPaymentMethod(text: string) {
  const lower = text.toLowerCase();
  if (/\bupi\b|gpay|phonepe|paytm/.test(lower)) return "UPI";
  if (/card|pos|visa|mastercard/.test(lower)) return "Card";
  if (/cash|atm/.test(lower)) return "Cash";
  if (/wallet/.test(lower)) return "Wallet";
  return "Bank Transfer";
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function value(row: Record<string, string>, header?: string) {
  return header ? row[header] || "" : "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function removeBlankMappings(mapping?: CsvMapping) {
  if (!mapping) return {};
  return Object.fromEntries(Object.entries(mapping).filter(([, selected]) => Boolean(selected))) as CsvMapping;
}
