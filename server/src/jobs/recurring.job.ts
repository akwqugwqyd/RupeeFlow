import cron from "node-cron";
import { runRecurringTransactions } from "../services/recurring.service.js";

export function startRecurringJob() {
  cron.schedule("5 0 1 * *", async () => {
    try {
      const result = await runRecurringTransactions();
      console.log(`Recurring transaction job created ${result.created} transactions`);
    } catch (error) {
      console.error("Recurring transaction job failed", error);
    }
  });
}
