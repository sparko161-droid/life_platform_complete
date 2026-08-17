# Local Environment

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Prerequisites
Git, Node.js LTS, pnpm, Docker Desktop/Engine and Flutter SDK for mobile.

## Services
`pnpm dev:infra` starts PostgreSQL, Redis and MinIO.

## Health checks
Postgres: `pg_isready`.
Redis: `PING`.
MinIO: web console on port 9001.

## Seed data
Use synthetic family/child accounts only. Seed scripts must be deterministic.

## Debugging
Prefer application logs and traces over database inspection as the first diagnostic step.
