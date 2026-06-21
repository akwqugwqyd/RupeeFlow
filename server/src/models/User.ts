import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: "INR", enum: ["INR"], uppercase: true },
    monthlyIncomeTarget: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.createWithPassword = async function createWithPassword(data) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  return this.create({ ...data, currency: "INR", passwordHash, password: undefined });
};

export default mongoose.model("User", userSchema);
