# Data Architecture

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Stores
PostgreSQL: transactional source of truth.
Redis: cache, locks, short-lived state and queue transport.
Object storage: images, audio, video and generated media.
Analytics store: introduced only when query load justifies it.

## Data categories
Identity data, child data, family data, task data, social data, communications, media, game state, economy ledger, telemetry, moderation records.

## IDs
Use UUID/UUIDv7 where supported. Public IDs must not reveal sequence information.

## Money
Never store mutable balance as sole truth. Use append-only ledger entries plus derived balance.

## Media
Store metadata and storage keys in PostgreSQL; objects live in S3-compatible storage. Use signed/authorized access.

## PII
Keep child PII minimal. Separate high-sensitivity fields and protect access by policy.

## Migrations
Forward migrations are versioned. Destructive changes require a staged migration and explicit ADR.
