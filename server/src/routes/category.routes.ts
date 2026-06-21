import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import Category from "../models/Category.js";
import { ensureDefaultCategories } from "../services/category.service.js";

const router = express.Router();
const body = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["income", "expense", "both"]).default("expense"),
  color: z.string().default("#0e5b4f")
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    await ensureDefaultCategories(req.user._id);
    res.json(await Category.find({ user: req.user._id }).sort({ isDefault: -1, name: 1 }));
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(z.object({ body })), async (req, res, next) => {
  try {
    const category = await Category.create({ ...req.validated.body, user: req.user._id });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) error.message = "Category already exists";
    next(error);
  }
});

router.delete("/:id", validate(z.object({ params: z.object({ id: z.string().min(1) }) })), async (req, res, next) => {
  try {
    const category = await Category.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!category) return res.status(404).json({ message: "Category not found" });
    if (category.isDefault) return res.status(400).json({ message: "Default categories cannot be deleted" });
    await category.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
