import type { Logger } from "pino";

export interface ErrorReporter {
  captureException(err: unknown, context?: Record<string, unknown>): void;
}

export interface InitErrorReportingOptions {
  logger: Logger;
  /** Falls back to process.env.SENTRY_DSN. */
  dsn?: string;
}

/**
 * "Sentry-class error reporting init helper" (P0-007). Deliberately does
 * NOT hard-depend on @sentry/node: this package stays installable and
 * testable without a real DSN or that (fairly heavy) dependency. When
 * SENTRY_DSN is set, @sentry/node becomes required at runtime as an
 * optional peer dependency -- add it to the consuming service's own
 * package.json when you actually turn this on.
 *
 * Without a DSN, captureException still does something useful: it logs
 * the error through the structured logger (see logger.ts) instead of
 * silently dropping it, so "no error reporting configured" never means
 * "errors vanish in local dev."
 */
export async function initErrorReporting(opts: InitErrorReportingOptions): Promise<ErrorReporter> {
  const dsn = opts.dsn ?? process.env.SENTRY_DSN;

  if (!dsn) {
    return {
      captureException(err, context) {
        opts.logger.error({ err, ...context }, "unhandled error (no SENTRY_DSN configured)");
      },
    };
  }

  try {
    // Optional peer dependency -- only resolved when a DSN is actually
    // configured. `@ts-expect-error`: no type declarations without the
    // package installed.
    // @ts-expect-error optional peer dependency, see doc comment above
    const Sentry = await import("@sentry/node");
    Sentry.init({ dsn });
    return {
      captureException(err, context) {
        Sentry.captureException(err, context ? { extra: context } : undefined);
      },
    };
  } catch (err) {
    opts.logger.warn(
      { err },
      "SENTRY_DSN is set but @sentry/node is not installed; falling back to log-only error reporting",
    );
    return {
      captureException(innerErr, context) {
        opts.logger.error({ err: innerErr, ...context }, "unhandled error (sentry unavailable)");
      },
    };
  }
}
