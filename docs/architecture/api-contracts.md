# API Contracts

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Contract source
OpenAPI is the canonical external API contract for REST.

## Versioning
Start with `/api/v1`. Breaking changes require a new version or migration strategy.

## Response rules
Use stable envelopes for errors. Never expose database errors or provider-specific details.

## Authorization
Resource access is checked server-side even when a client hides the feature.

## Idempotency
Use idempotency keys for reward redemption, money ledger writes, completion submissions and integration callbacks.

## Pagination
Cursor pagination for social feeds, messages, catalogs and activity history.

## Webhooks
All inbound webhooks are authenticated, replay-protected where supported, rate-limited and idempotent.

## Typed clients
Generate or validate typed clients from OpenAPI where practical. Avoid hand-maintained duplicate request/response types.

## Generation pipeline
`services/api/openapi/openapi.yaml` is the spec. `pnpm --filter @life/api-client run generate` (openapi-typescript) writes `packages/api-client/src/generated/openapi.d.ts`; commit the regenerated output alongside any spec change. `scripts/check-generate-no-diff.mjs` in that package regenerates and fails on drift — wire it into CI once `.github/workflows/ci.yml` needs a secret-free check step for this (P0-001).
