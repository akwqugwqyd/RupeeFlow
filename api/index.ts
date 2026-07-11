let appPromise: Promise<any> | undefined;
let dbPromise: Promise<any> | undefined;
let runRecurringTransactionsPromise: Promise<() => Promise<any>> | undefined;

async function loadApp() {
  if (!appPromise) {
    appPromise = import("../server/src/app.js").then(({ createApp }) => createApp());
  }

  return appPromise;
}

async function loadRunRecurringTransactions() {
  if (!runRecurringTransactionsPromise) {
    runRecurringTransactionsPromise = import("../server/src/services/recurring.service.js").then(
      ({ runRecurringTransactions }) => runRecurringTransactions
    );
  }

  return runRecurringTransactionsPromise;
}

function ensureDb() {
  if (!dbPromise) {
    dbPromise = import("../server/src/config/db.js")
      .then(({ connectDb }) => connectDb())
      .catch((error) => {
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

      const runRecurringTransactions = await loadRunRecurringTransactions();
      const result = await runRecurringTransactions();
      return response.json(result);
    }

    const app = await loadApp();
    return app(request, response);
  } catch (error) {
    console.error("Vercel function failed", error);
    return response.status(500).json({ message: "Internal server error" });
  }
}
