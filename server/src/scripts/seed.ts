import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import Bill from "../models/Bill.js";
import Budget from "../models/Budget.js";
import Category from "../models/Category.js";
import Goal from "../models/Goal.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { defaultCategories } from "../utils/finance.js";

dotenv.config();

const month = new Date().toISOString().slice(0, 7);
const [year, monthNumber] = month.split("-").map(Number);

await connectDb();
await Promise.all([User.deleteMany({ email: "demo@rupeeflow.app" })]);

const user = await User.create({
  name: "Demo User",
  email: "demo@rupeeflow.app",
  passwordHash: await bcrypt.hash("password123", 12),
  currency: "INR",
  monthlyIncomeTarget: 150000
});

await Transaction.insertMany([
  tx("income", 150000, "Salary", "Acme Payroll", 1, "Bank Transfer", true),
  tx("expense", 45000, "Rent", "Apartment Rent", 2, "Bank Transfer", true),
  tx("expense", 4200, "Food", "BigBasket", 4),
  tx("expense", 1450, "Travel", "Metro Card", 6),
  tx("expense", 5200, "Bills", "PowerGrid", 8),
  tx("expense", 3100, "Other", "Concert tickets", 11),
  tx("expense", 1800, "Other", "Pharmacy", 13),
  tx("expense", 2600, "Shopping", "Work shoes", 15),
  tx("expense", 350, "Food", "Zomato", 17),
  tx("expense", 10000, "Other", "Mutual fund transfer", 18)
]);

await Category.insertMany(defaultCategories.map((category) => ({ ...category, user: user._id, isDefault: true })));

await Budget.insertMany([
  { user: user._id, category: "Food", limit: 12000, month },
  { user: user._id, category: "Travel", limit: 6000, month },
  { user: user._id, category: "Bills", limit: 8000, month },
  { user: user._id, category: "Shopping", limit: 7000, month }
]);

await Goal.insertMany([
  { user: user._id, name: "Emergency fund", targetAmount: 600000, currentAmount: 220000, priority: "high" },
  { user: user._id, name: "Laptop upgrade", targetAmount: 160000, currentAmount: 65000, priority: "medium" }
]);

await Bill.insertMany([
  { user: user._id, name: "Rent", amount: 45000, category: "Rent", dueDay: 2, autopay: true },
  { user: user._id, name: "Internet", amount: 999, category: "Bills", dueDay: 9, autopay: true },
  { user: user._id, name: "Insurance", amount: 2400, category: "Bills", dueDay: 14, autopay: false }
]);

console.log("Seeded demo@rupeeflow.app / password123");
await mongoose.disconnect();

function tx(type, amount, category, merchant, day, paymentMethod = "Card", isRecurring = false) {
  return {
    user: user._id,
    type,
    amount,
    category,
    merchant,
    date: new Date(Date.UTC(year, monthNumber - 1, day)),
    paymentMethod,
    isRecurring
  };
}
