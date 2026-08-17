# Observability

**Status:** Foundation
**Owner:** SRE / AI CTO

## Signals

- logs
- metrics
- traces
- frontend errors
- mobile crashes
- queue depth
- websocket connection health
- notification delivery

## Correlation

Every request and async job gets a correlation id.
Domain events preserve causation/correlation where available.

## Privacy

Logs must never contain raw child message content, raw media, secrets or unnecessary personal data.

## Alerts

Alert on:

- elevated API error rate
- high P95 latency
- queue backlog
- failed jobs
- storage failures
- authentication anomalies
- moderation pipeline failures

## Tools

Sentry + OpenTelemetry are the default direction. Metrics/dashboard implementation can evolve without changing domain code.
