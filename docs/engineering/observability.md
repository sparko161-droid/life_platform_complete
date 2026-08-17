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
