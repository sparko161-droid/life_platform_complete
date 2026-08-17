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
