import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Goal from "../models/Goal.js";

const router = express.Router();
const body = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().min(0).default(0),
  targetDate: z.coerce.date().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium")
});
const id = z.object({ params: z.object({ id: z.string().min(1) }) });

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json(await Goal.find({ user: req.user._id }).sort({ priority: 1, targetDate: 1 }));
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(z.object({ body })), async (req, res, next) => {
  try {
    res.status(201).json(await Goal.create({ ...req.validated.body, user: req.user._id }));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(id.extend({ body: body.partial() })), async (req, res, next) => {
  try {
    const goal = await Goal.findOneAndUpdate({ _id: req.validated.params.id, user: req.user._id }, req.validated.body, { new: true, runValidators: true });
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    res.json(goal);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate(id), async (req, res, next) => {
  try {
    await Goal.findOneAndDelete({ _id: req.validated.params.id, user: req.user._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
