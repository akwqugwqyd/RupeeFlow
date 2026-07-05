import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true },
    merchant: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, default: "Card", trim: true },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    recurringStatus: { type: String, enum: ["active", "paused"], default: "active" },
    recurringAnchorDay: { type: Number, min: 1, max: 31 },
    recurringTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    lastRecurringRun: { type: Date },
    generationKey: { type: String },
    idempotencyKey: { type: String, maxlength: 128 }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ generationKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ user: 1, isRecurring: 1, recurringStatus: 1 });

export default mongoose.model("Transaction", transactionSchema);
