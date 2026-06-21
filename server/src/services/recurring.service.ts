import Transaction from "../models/Transaction.js";

export async function runRecurringTransactions(now = new Date()) {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const templates = await Transaction.find({ isRecurring: true, recurringTemplate: { $exists: false } });
  let created = 0;

  for (const template of templates) {
    if (template.lastRecurringRun && template.lastRecurringRun >= startOfMonth) continue;
    const exists = await Transaction.exists({
      user: template.user,
      recurringTemplate: template._id,
      date: { $gte: startOfMonth }
    });
    if (exists) continue;

    await Transaction.create({
      user: template.user,
      type: template.type,
      amount: template.amount,
      category: template.category,
      merchant: template.merchant,
      note: template.note || "Auto-added recurring transaction",
      date: now,
      paymentMethod: template.paymentMethod,
      tags: template.tags,
      isRecurring: false,
      recurringTemplate: template._id
    });
    template.lastRecurringRun = now;
    await template.save();
    created += 1;
  }

  return { created };
}
