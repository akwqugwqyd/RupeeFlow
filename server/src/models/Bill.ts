import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true },
    dueDay: { type: Number, required: true, min: 1, max: 31 },
    autopay: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "paused"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
