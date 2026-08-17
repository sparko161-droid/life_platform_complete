# Data Architecture

**Status:** Foundation
**Owner:** Backend Lead

## System of record

PostgreSQL.

## Supporting stores

Redis: cache, locks, rate limits, queue transport, ephemeral realtime state.
Object Storage: photos, videos, audio, generated media.

## Financial model

Money and coins use append-only ledgers plus derived balance/cache. Never rely on a single mutable balance column as the sole source of truth.

## Media model

DB stores metadata and ownership. Object storage stores binary objects.

## Privacy

Child media and messages are private by default. Retention must be policy-driven.

## Versioning

Content templates, tasks, quests and knowledge items are versioned.
Historical assignments keep references to the version that was active at creation.

## Audit

Critical changes create audit entries: actor, object, action, time, before/after or event reference, reason when applicable.

## Migrations

Every schema change is a versioned migration committed to Git and run in CI against a clean database.
