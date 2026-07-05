import dotenv from "dotenv";
dotenv.config();

import type { Server } from "node:http";
import { createApp } from "./app.js";
import { disconnectDb, connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startRecurringJob } from "./jobs/recurring.job.js";
import { logger } from "./utils/logger.js";

let server: Server | undefined;
let recurringJob: ReturnType<typeof startRecurringJob> | undefined;

async function start() {
  const config = env();
  await connectDb();
  recurringJob = startRecurringJob();
  server = createApp().listen(config.PORT, () => {
    logger.info("server.started", { port: config.PORT, environment: config.NODE_ENV });
  });
}

async function shutdown(signal: string) {
  logger.info("server.shutdown_started", { signal });
  recurringJob?.stop();
  const forceTimer = setTimeout(() => {
    logger.error("server.shutdown_timeout");
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await disconnectDb();
  clearTimeout(forceTimer);
  logger.info("server.shutdown_completed");
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

start().catch((error) => {
  logger.error("server.start_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
