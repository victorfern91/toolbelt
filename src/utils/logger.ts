type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function makeLogger(minLevel: Level = "info") {
  const enabled = (level: Level) => ORDER[level] >= ORDER[minLevel];
  const write = (level: Level, args: unknown[]) => {
    if (!enabled(level)) return;
    const out = level === "error" || level === "warn" ? console.error : console.log;
    out(`[${level}]`, ...args);
  };
  return {
    debug: (...args: unknown[]) => write("debug", args),
    info: (...args: unknown[]) => write("info", args),
    warn: (...args: unknown[]) => write("warn", args),
    error: (...args: unknown[]) => write("error", args),
  };
}

export type Logger = ReturnType<typeof makeLogger>;

export const logger = makeLogger(process.env.TOOLBELT_DEBUG ? "debug" : "info");
