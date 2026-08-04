import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true, trim: true },
    limit: { type: Number, required: true, min: 1 },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, category: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", budgetSchema);
