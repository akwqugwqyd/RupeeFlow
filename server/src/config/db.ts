import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env().MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    minPoolSize: process.env.VERCEL ? 0 : env().NODE_ENV === "production" ? 2 : 0
  });
  logger.info("database.connected");
}

export async function disconnectDb() {
  await mongoose.disconnect();
  logger.info("database.disconnected");
}
