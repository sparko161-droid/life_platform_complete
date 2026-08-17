import pino, { type Logger } from "pino";
import { currentCorrelation } from "./correlation.js";

/**
 * "Structured logs only; no child PII or message text in default logs."
 * -- docs/engineering/coding-standards.md.
 * "Default telemetry excludes child message content, raw media and
 * sensitive profile fields." -- docs/engineering/observability.md.
 *
 * These paths are redacted by default across every field name in the log
 * object tree (pino's `redact.paths` with a leading `*.` wildcard). This is
 * a safety net, not a substitute for not logging PII in the first place.
 */
const DEFAULT_REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "messageText",
  "*.messageText",
  "content",
  "*.content",
  "photoUrl",
  "*.photoUrl",
  "videoUrl",
  "*.videoUrl",
  "email",
  "*.email",
  "phone",
  "*.phone",
  "ssn",
  "*.ssn",
];

export interface CreateLoggerOptions {
  name: string;
  level?: string;
  /** Additional field names to redact on top of DEFAULT_REDACT_PATHS. */
  extraRedactPaths?: string[];
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  return pino({
    name: opts.name,
    level: opts.level ?? process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [...DEFAULT_REDACT_PATHS, ...(opts.extraRedactPaths ?? [])],
      censor: "[REDACTED]",
    },
    // Injects correlation/causation ids from the current AsyncLocalStorage
    // context (see correlation.ts) into every log line automatically, so
    // call sites don't have to remember to pass them.
    mixin() {
      const ctx = currentCorrelation();
      return ctx ? { correlation_id: ctx.correlationId, causation_id: ctx.causationId } : {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
