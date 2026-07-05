import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";
import { AppError } from "../utils/errors.js";
import { dueOccurrences, nextOccurrence, runRecurringTransactions } from "../services/recurring.service.js";

const router = express.Router();

const transactionBody = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive().max(1_000_000_000),
  category: z.string().trim().min(1).max(60),
  merchant: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  date: z.coerce.date(),
  paymentMethod: z.string().trim().max(50).optional().default("Card"),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  isRecurring: z.coerce.boolean().optional().default(false),
  recurringFrequency: z.enum(["monthly", "yearly"]).optional().default("monthly")
});

const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(["income", "expense"]).optional(),
    category: z.string().trim().max(60).optional(),
    search: z.string().trim().max(120).optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  }).superRefine((value, context) => {
    if (value.minAmount !== undefined && value.maxAmount !== undefined && value.minAmount > value.maxAmount) {
      context.addIssue({ code: "custom", path: ["maxAmount"], message: "Maximum amount must be at least the minimum amount" });
    }
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
    }
  })
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record id");
const idSchema = z.object({ params: z.object({ id: objectId }) });

router.use(requireAuth);

router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit, type, category, search, minAmount, maxAmount, startDate, endDate } = req.validated.query;
    const filter = buildFilter(req.user._id, { type, category, search, minAmount, maxAmount, startDate, endDate });

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Transaction.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(z.object({ body: transactionBody })), async (req, res, next) => {
  try {
    await assertCategoryOwnership(req.user._id, req.validated.body.category, req.validated.body.type);
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
    if (idempotencyKey && !/^[\w.-]{8,128}$/.test(idempotencyKey)) {
      throw new AppError("Invalid Idempotency-Key", 400, "INVALID_IDEMPOTENCY_KEY");
    }
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ user: req.user._id, idempotencyKey });
      if (existing) return res.status(200).json(existing);
    }
    const body = req.validated.body;
    const item = await Transaction.create({
      ...body,
      user: req.user._id,
      recurringAnchorDay: body.isRecurring ? body.date.getUTCDate() : undefined,
      idempotencyKey: idempotencyKey || undefined
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(idSchema.extend({ body: transactionBody.partial() })), async (req, res, next) => {
  try {
    const current = await Transaction.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!current) return res.status(404).json({ message: "Transaction not found" });
    if (req.validated.body.category || req.validated.body.type) {
      await assertCategoryOwnership(
        req.user._id,
        req.validated.body.category || current.category,
        req.validated.body.type || current.type
      );
    }
    const update = {
      ...req.validated.body,
      ...(req.validated.body.date && current.isRecurring && { recurringAnchorDay: req.validated.body.date.getUTCDate() })
    };
    const item = await Transaction.findOneAndUpdate(
      { _id: req.validated.params.id, user: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: "Transaction not found" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate(idSchema), async (req, res, next) => {
  try {
    const item = await Transaction.findOneAndDelete({ _id: req.validated.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: "Transaction not found" });
    if (item.isRecurring && !item.recurringTemplate) {
      await Transaction.updateMany(
        { user: req.user._id, recurringTemplate: item._id },
        { $unset: { recurringTemplate: 1 } }
      );
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/export/csv", validate(listSchema), async (req, res, next) => {
  try {
    const rows = await Transaction.find(buildFilter(req.user._id, req.validated.query)).sort({ date: -1 }).limit(100_000).lean();
    const header = ["date", "type", "amount", "category", "merchant", "paymentMethod", "note"];
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) => `"${csvCell(key === "date" ? row[key].toISOString().slice(0, 10) : row[key] ?? "")}"`)
          .join(",")
      )
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=rupeeflow-transactions.csv");
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
});

router.get("/recurring/preview", async (req, res, next) => {
  try {
    const templates = await Transaction.find({
      user: req.user._id,
      isRecurring: true,
      recurringTemplate: { $exists: false }
    }).sort({ date: 1 }).lean();
    res.json({
      items: templates.map((template) => ({
        ...template,
        nextDate: template.recurringStatus === "paused" ? null : nextOccurrence(template)?.toISOString(),
        missedCount: dueOccurrences(template, new Date())
          .filter((date) => date > (template.lastRecurringRun || template.date))
          .length
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/recurring-status",
  validate(idSchema.extend({ body: z.object({ status: z.enum(["active", "paused"]) }) })),
  async (req, res, next) => {
    try {
      const item = await Transaction.findOneAndUpdate(
        { _id: req.validated.params.id, user: req.user._id, isRecurring: true, recurringTemplate: { $exists: false } },
        { recurringStatus: req.validated.body.status },
        { new: true, runValidators: true }
      );
      if (!item) return res.status(404).json({ message: "Recurring transaction not found" });
      if (item.recurringStatus === "active") await runRecurringTransactions(new Date(), req.user._id);
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

async function assertCategoryOwnership(userId, categoryName: string, transactionType: string) {
  const category = await Category.findOne({ user: userId, name: categoryName }).collation({ locale: "en", strength: 2 });
  if (!category) throw new AppError("Category does not belong to this user", 400, "INVALID_CATEGORY");
  if (category.type !== "both" && category.type !== transactionType) {
    throw new AppError(`Category cannot be used for ${transactionType} transactions`, 400, "CATEGORY_TYPE_MISMATCH");
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(userId, query) {
  const { type, category, search, minAmount, maxAmount, startDate, endDate } = query;
  const filter: any = { user: userId };
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.amount = { ...(minAmount !== undefined && { $gte: minAmount }), ...(maxAmount !== undefined && { $lte: maxAmount }) };
  }
  if (startDate || endDate) {
    const exclusiveEnd = endDate ? new Date(endDate.getTime() + 86400000) : undefined;
    filter.date = { ...(startDate && { $gte: startDate }), ...(exclusiveEnd && { $lt: exclusiveEnd }) };
  }
  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$or = [{ merchant: new RegExp(safeSearch, "i") }, { note: new RegExp(safeSearch, "i") }, { category: new RegExp(safeSearch, "i") }];
  }
  return filter;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return spreadsheetSafe.replaceAll('"', '""');
}

export default router;
