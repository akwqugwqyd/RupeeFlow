import cron from "node-cron";
import { runRecurringTransactions } from "../services/recurring.service.js";
import { logger } from "../utils/logger.js";

export function startRecurringJob() {
  return cron.schedule("15 0 * * *", async () => {
    try {
      const result = await runRecurringTransactions();
      logger.info("recurring.job_succeeded", result);
    } catch (error) {
      logger.error("recurring.job_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  });
}
