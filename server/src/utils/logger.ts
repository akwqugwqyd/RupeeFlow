const levels = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level: keyof typeof levels, message: string, context: Record<string, unknown> = {}) {
  const configured = (process.env.LOG_LEVEL as keyof typeof levels) || "info";
  if (levels[level] < (levels[configured] || levels.info)) return;
  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([key]) => !/password|token|authorization|secret/i.test(key))
  );
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...safeContext });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
};
