import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import User from "../models/User.js";
import { ensureDefaultCategories } from "../services/category.service.js";
import { signToken } from "../utils/tokens.js";

const router = express.Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    email: z.email().toLowerCase(),
    password: z.string().min(8).max(128),
    monthlyIncomeTarget: z.coerce.number().min(0).default(0)
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.email().toLowerCase(),
    password: z.string().min(1)
  })
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    monthlyIncomeTarget: z.coerce.number().min(0).optional()
  })
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const exists = await User.exists({ email: req.validated.body.email });
    if (exists) {
      const error: any = new Error("Email is already registered");
      error.statusCode = 409;
      throw error;
    }

    const user = await (User as any).createWithPassword(req.validated.body);
    await ensureDefaultCategories(user._id);
    const token = signToken(user);
    res.status(201).json({ token, user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.validated.body.email });
    if (!user || !(await (user as any).comparePassword(req.validated.body.password))) {
      const error: any = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    res.json({ token: signToken(user), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

router.put("/me", requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user?._id, req.validated.body, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    currency: "INR",
    monthlyIncomeTarget: user.monthlyIncomeTarget
  };
}

export default router;
