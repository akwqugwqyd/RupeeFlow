import Category from "../models/Category.js";
import { defaultCategories } from "../utils/finance.js";

export async function ensureDefaultCategories(userId) {
  const existing = await Category.countDocuments({ user: userId });
  if (existing > 0) return;
  await Category.insertMany(defaultCategories.map((category) => ({ ...category, user: userId, isDefault: true })));
}
