import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrapTracing } from "../src/tracing.js";

test("bootstrapTracing no-ops (returns null, does not throw) without OTEL_EXPORTER_OTLP_ENDPOINT", () => {
  const original = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  try {
    const handle = bootstrapTracing({ serviceName: "test-service" });
    assert.equal(handle, null);
  } finally {
    if (original !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = original;
  }
});

test("bootstrapTracing starts and returns a shutdown handle when an endpoint is configured", async () => {
  const original = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  // Doesn't need to be reachable -- the exporter only tries to connect
  // when a span is actually flushed, which this test never does. This
  // only proves bootstrapTracing() doesn't throw when it decides to
  // start the SDK.
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318/v1/traces";
  try {
    const handle = bootstrapTracing({ serviceName: "test-service" });
    assert.ok(handle);
    await handle?.shutdown();
  } finally {
    if (original === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = original;
  }
});
