import pino from "pino";

const validLogLevels = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const configuredLogLevel = process.env.LOG_LEVEL?.trim().toLowerCase();

export const logger = pino({
  level:
    configuredLogLevel && validLogLevels.has(configuredLogLevel) ? configuredLogLevel : "info",
  base: { service: "verytis-worker" }
});
