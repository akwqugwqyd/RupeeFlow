import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

const transactionBody = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive(),
  category: z.string().min(1).max(80),
  merchant: z.string().max(120).optional().default(""),
  note: z.string().max(500).optional().default(""),
  date: z.coerce.date(),
  paymentMethod: z.string().max(50).optional().default("Card"),
  tags: z.array(z.string().max(30)).optional().default([]),
  isRecurring: z.coerce.boolean().optional().default(false),
  recurringFrequency: z.enum(["monthly"]).optional().default("monthly")
});

const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(["income", "expense"]).optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  })
});

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });

router.use(requireAuth);

router.get("/", validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit, type, category, search, minAmount, maxAmount, startDate, endDate } = req.validated.query;
    const filter: any = { user: req.user._id };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (minAmount !== undefined || maxAmount !== undefined) filter.amount = { ...(minAmount !== undefined && { $gte: minAmount }), ...(maxAmount !== undefined && { $lte: maxAmount }) };
    if (startDate || endDate) filter.date = { ...(startDate && { $gte: startDate }), ...(endDate && { $lte: endDate }) };
    if (search) filter.$or = [{ merchant: new RegExp(search, "i") }, { note: new RegExp(search, "i") }];

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
    const item = await Transaction.create({ ...req.validated.body, user: req.user._id });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(idSchema.extend({ body: transactionBody.partial() })), async (req, res, next) => {
  try {
    const item = await Transaction.findOneAndUpdate(
      { _id: req.validated.params.id, user: req.user._id },
      req.validated.body,
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
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/export/csv", async (req, res, next) => {
  try {
    const rows = await Transaction.find({ user: req.user._id }).sort({ date: -1 }).lean();
    const header = ["date", "type", "amount", "category", "merchant", "paymentMethod", "note"];
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) => `"${String(key === "date" ? row[key].toISOString().slice(0, 10) : row[key] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=rupeeflow-transactions.csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
