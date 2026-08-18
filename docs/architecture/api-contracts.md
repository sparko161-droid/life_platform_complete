# API Contracts

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Contract source
OpenAPI is the canonical external API contract for REST.

## Versioning
Start with `/api/v1`. Breaking changes require a new version or migration strategy.
Which entities are frozen at which version, who owns them and which tasks
consume them is tracked in `contracts/registry.yaml` — see
`docs/architecture/contract-registry.md` (P0-010).

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
`services/api/openapi/openapi.yaml` is the spec. `pnpm --filter @life/api-client run generate` (openapi-typescript) writes `packages/api-client/src/generated/openapi.d.ts`; commit the regenerated output alongside any spec change. `scripts/check-generate-no-diff.mjs` in that package regenerates and fails on drift; CI runs it as the "OpenAPI client is up to date" step in `.github/workflows/ci.yml`'s `checks` job.
