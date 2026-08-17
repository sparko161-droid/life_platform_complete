# @life/observability

Baseline logging, tracing and error-reporting for `docs/engineering/observability.md`
(P0-007). Depends on P0-002's local dev stack existing but not on it
running — every piece here degrades to a safe no-op when its backing infra
isn't configured, so a developer with no OTel collector / Sentry DSN
running locally never gets blocked.

## `createLogger` (`src/logger.ts`)

Structured JSON logs via `pino`. Redacts a default list of sensitive field
names (`password`, `token`, `messageText`, `content`, `photoUrl`, `email`,
...) at any depth, matching `docs/engineering/coding-standards.md`
("Structured logs only; no child PII or message text in default logs")
and `docs/engineering/observability.md` ("Default telemetry excludes child
message content, raw media and sensitive profile fields"). Extend the list
per call site with `extraRedactPaths` for domain-specific sensitive fields.

Every log line automatically carries `correlation_id`/`causation_id` when
called from inside a `runWithNewCorrelation`/`runWithCausation` block (see
below) via a pino `mixin()` — call sites don't pass these manually.

## Correlation IDs (`src/correlation.ts`)

Implements "Every request receives a correlation ID. Async jobs preserve
causation/correlation metadata" from `docs/engineering/observability.md`.

- `runWithNewCorrelation(fn)` — call this once per inbound request/job at
  the entry point. Sets `correlationId === causationId` (this is the start
  of a new causal chain).
- `runWithCausation(parentCtx, fn)` — call this when one unit of work
  triggers another (e.g. an HTTP handler enqueues a BullMQ job). Keeps
  `correlationId` from the parent, mints a fresh `causationId` for this
  hop, so you can always answer both "which request started this?" and
  "what directly triggered this step?".
- Backed by `AsyncLocalStorage`; verified not to leak across concurrent
  unrelated async chains (see `test/correlation.test.ts`).

## Tracing (`src/tracing.ts`)

`bootstrapTracing({ serviceName })` starts the OpenTelemetry Node SDK
**only if** `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise it returns
`null` immediately without starting anything. Verified both paths: no-op
when unset, and a real SDK start/shutdown cycle when set to a local OTLP
URL (the exporter is never required to actually be reachable for
`bootstrapTracing` itself to succeed — only a flush would need that).

## Error reporting (`src/errors.ts`)

`initErrorReporting({ logger })` is "Sentry-class", not a hard dependency
on Sentry specifically: without `SENTRY_DSN`, `captureException` logs the
error through the structured logger instead of silently dropping it. With
`SENTRY_DSN` set, it dynamically imports `@sentry/node` as an **optional
peer dependency** — add `@sentry/node` to the consuming service's own
`package.json` when actually turning this on; this package stays light
and testable without it.

## Known workaround

`tsconfig.json` sets `skipLibCheck: true`, scoped to this package only.
`@opentelemetry/sdk-logs@0.55.0`'s own `.d.ts` (pulled in transitively by
`@opentelemetry/sdk-node`) isn't compatible with the repo-wide
`exactOptionalPropertyTypes: true` -- a bug in their type declarations,
not in this package's code. `skipLibCheck` is TypeScript's standard
mitigation for that class of problem.
