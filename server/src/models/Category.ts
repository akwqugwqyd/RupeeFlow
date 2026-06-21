import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ["income", "expense", "both"], default: "expense" },
    color: { type: String, default: "#0e5b4f" },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

categorySchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
