import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export interface TracingOptions {
  serviceName: string;
  serviceVersion?: string;
}

export interface TracingHandle {
  shutdown: () => Promise<void>;
}

/**
 * Starts the OpenTelemetry SDK only when OTEL_EXPORTER_OTLP_ENDPOINT is
 * set. Deliberately no-ops (returns null, does not throw, does not start
 * any background exporter) when it isn't -- a developer running things
 * locally without a collector must not see tracing crash or hang their
 * process, per the observability baseline being additive infrastructure,
 * not a hard requirement to run the app.
 */
export function bootstrapTracing(opts: TracingOptions): TracingHandle | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return null;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: opts.serviceName,
      [ATTR_SERVICE_VERSION]: opts.serviceVersion ?? "0.0.0",
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
  });

  sdk.start();

  return {
    shutdown: () => sdk.shutdown(),
  };
}
