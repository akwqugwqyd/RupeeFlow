import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Bill from "../models/Bill.js";

const router = express.Router();
const body = z.object({
  name: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  category: z.string().min(1).max(80),
  dueDay: z.coerce.number().int().min(1).max(31),
  autopay: z.coerce.boolean().default(false),
  status: z.enum(["active", "paused"]).default("active")
});
const id = z.object({ params: z.object({ id: z.string().min(1) }) });

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json(await Bill.find({ user: req.user._id }).sort({ dueDay: 1 }));
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(z.object({ body })), async (req, res, next) => {
  try {
    res.status(201).json(await Bill.create({ ...req.validated.body, user: req.user._id }));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(id.extend({ body: body.partial() })), async (req, res, next) => {
  try {
    const bill = await Bill.findOneAndUpdate({ _id: req.validated.params.id, user: req.user._id }, req.validated.body, { new: true, runValidators: true });
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json(bill);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate(id), async (req, res, next) => {
  try {
    await Bill.findOneAndDelete({ _id: req.validated.params.id, user: req.user._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
