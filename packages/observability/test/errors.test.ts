import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "../src/logger.js";
import { initErrorReporting } from "../src/errors.js";

test("without SENTRY_DSN, captureException logs through the fallback logger instead of throwing/vanishing", async () => {
  const original = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    const logger = createLogger({ name: "errors-test" });
    let captured: unknown;
    logger.error = ((obj: unknown) => {
      captured = obj;
    }) as typeof logger.error;

    const reporter = await initErrorReporting({ logger });
    const err = new Error("boom");
    reporter.captureException(err, { extra: "context" });

    assert.ok(captured);
    assert.equal((captured as { err: unknown }).err, err);
    assert.equal((captured as { extra: string }).extra, "context");
  } finally {
    if (original !== undefined) process.env.SENTRY_DSN = original;
  }
});
