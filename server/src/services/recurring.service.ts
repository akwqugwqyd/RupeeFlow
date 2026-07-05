import Transaction from "../models/Transaction.js";
import { logger } from "../utils/logger.js";

export async function runRecurringTransactions(now = new Date(), userId?: unknown) {
  const templates = await Transaction.find({
    ...(userId && { user: userId }),
    isRecurring: true,
    recurringStatus: { $ne: "paused" },
    recurringTemplate: { $exists: false }
  });
  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const completedThrough = template.lastRecurringRun || template.date;
    const occurrences = dueOccurrences(template, now)
      .filter((occurrence) => occurrence > completedThrough)
      .slice(0, 24);
    for (const occurrence of occurrences) {
      const period = occurrence.toISOString().slice(0, 7);
      const generationKey = `${template._id}:${period}`;
      try {
        const result = await Transaction.updateOne(
          { generationKey },
          {
            $setOnInsert: {
              user: template.user,
              type: template.type,
              amount: template.amount,
              category: template.category,
              merchant: template.merchant,
              note: template.note || "Auto-added recurring transaction",
              date: occurrence,
              paymentMethod: template.paymentMethod,
              tags: template.tags,
              isRecurring: false,
              recurringTemplate: template._id,
              generationKey
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) created += 1;
        else skipped += 1;
      } catch (error: any) {
        if (error.code === 11000) skipped += 1;
        else throw error;
      }
    }
    if (occurrences.length) {
      template.lastRecurringRun = occurrences[occurrences.length - 1];
      template.recurringAnchorDay ||= template.date.getUTCDate();
      await template.save();
    }
  }

  logger.info("recurring.completed", { templates: templates.length, created, skipped });
  return { templates: templates.length, created, skipped };
}

export function dueOccurrences(template: any, now = new Date()) {
  const start = template.date as Date;
  const anchorDay = template.recurringAnchorDay || start.getUTCDate();
  const occurrences: Date[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const yearly = template.recurringFrequency === "yearly";

  while (true) {
    if (yearly) year += 1;
    else {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const targetMonth = yearly ? start.getUTCMonth() : month;
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    const occurrence = new Date(Date.UTC(year, targetMonth, Math.min(anchorDay, lastDay)));
    if (occurrence > now) break;
    occurrences.push(occurrence);
    if (occurrences.length >= 120) break;
  }
  return occurrences;
}

export function nextOccurrence(template: any, after = new Date()) {
  const probe = new Date(after);
  probe.setUTCFullYear(probe.getUTCFullYear() + 20);
  return dueOccurrences(template, probe).find((date) => date > after) || null;
}
