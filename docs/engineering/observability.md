# Observability

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Signals
Logs, metrics, traces, errors, audit events.

## Correlation
Every request receives a correlation ID. Async jobs preserve causation/correlation metadata.

## Metrics
API P50/P95/P99, error rate, queue lag, WebSocket sessions, push success, media failures, AI latency/cost, camera session stability.

## Alerts
Alert on user-impacting symptoms, not noisy internal events.

## Privacy
Default telemetry excludes child message content, raw media and sensitive profile fields.

## Implementation
`packages/observability` (P0-007): structured logger with default PII
redaction, `AsyncLocalStorage`-backed correlation/causation ids, an
OpenTelemetry tracing bootstrap that no-ops without
`OTEL_EXPORTER_OTLP_ENDPOINT`, and a Sentry-class error reporter that logs
through the structured logger when `SENTRY_DSN` isn't set. Metrics/alerts
backends are not chosen yet -- tracked as an open item for whoever wires
the first real service up to this package.
