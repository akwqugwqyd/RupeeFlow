import { createApp } from "../server/src/app.js";
import { connectDb } from "../server/src/config/db.js";
import { runRecurringTransactions } from "../server/src/services/recurring.service.js";

const app = createApp();
let dbPromise: ReturnType<typeof connectDb> | undefined;

function ensureDb() {
  if (!dbPromise) {
    dbPromise = connectDb().catch((error) => {
      dbPromise = undefined;
      throw error;
    });
  }
  return dbPromise;
}

function restoreApiUrl(request: any) {
  const path = typeof request.query?.path === "string" ? request.query.path : "";
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (key === "path" || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
    } else {
      search.append(key, String(value));
    }
  }

  const query = search.toString();
  request.url = `/api/${path}${query ? `?${query}` : ""}`;
  return path;
}

export default async function handler(request: any, response: any) {
  try {
    await ensureDb();
    const path = restoreApiUrl(request);

    if (path === "cron/recurring") {
      const secret = process.env.CRON_SECRET;
      if (!secret || request.headers.authorization !== `Bearer ${secret}`) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const result = await runRecurringTransactions();
      return response.json(result);
    }

    return app(request, response);
  } catch (error) {
    console.error("Vercel function failed", error);
    return response.status(500).json({ message: "Internal server error" });
  }
}
