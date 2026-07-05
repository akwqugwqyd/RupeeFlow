import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Bill from "../models/Bill.js";
import Goal from "../models/Goal.js";
import Transaction from "../models/Transaction.js";
import { buildOverview, buildReport } from "../services/analytics.service.js";
import { nextOccurrence } from "../services/recurring.service.js";
import { currentMonth } from "../utils/finance.js";

const router = express.Router();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
router.use(requireAuth);

router.get(
  "/overview",
  validate(z.object({ query: z.object({ month: monthSchema.default(currentMonth()) }) })),
  async (req, res, next) => {
    try {
      const { month } = req.validated.query;
      const [analytics, goals, bills, recent, templates] = await Promise.all([
        buildOverview(req.user._id, month),
        Goal.find({ user: req.user._id }).sort({ targetDate: 1 }).lean(),
        Bill.find({ user: req.user._id, status: "active" }).sort({ dueDay: 1 }).lean(),
        Transaction.find({ user: req.user._id }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
        Transaction.find({
          user: req.user._id,
          isRecurring: true,
          recurringStatus: { $ne: "paused" },
          recurringTemplate: { $exists: false }
        }).lean()
      ]);
      const upcomingRecurring = templates
        .map((template) => ({ ...template, nextDate: nextOccurrence(template)?.toISOString() }))
        .filter((item) => item.nextDate)
        .sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)))
        .slice(0, 8);
      res.json({
        ...analytics,
        goals,
        bills,
        upcomingRecurring,
        recentTransactions: recent,
        summary: {
          ...analytics.summary,
          billTotal: bills.reduce((sum, bill) => sum + bill.amount, 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/report",
  validate(z.object({
    query: z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      granularity: z.enum(["month", "quarter", "year"]).default("month")
    }).refine((value) => value.endDate > value.startDate, { message: "endDate must be after startDate" })
  })),
  async (req, res, next) => {
    try {
      const { startDate, endDate, granularity } = req.validated.query;
      const maximumRange = 10 * 366 * 86400000;
      if (endDate.getTime() - startDate.getTime() > maximumRange) {
        return res.status(400).json({ message: "Report range cannot exceed 10 years" });
      }
      res.json({
        startDate,
        endDate,
        granularity,
        periods: await buildReport(req.user._id, startDate, endDate, granularity)
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
