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

## Secrets
Copy `.env.example` to `.env`, or (preferred) `doppler setup && doppler run -- <command>` so nothing lands on disk in plaintext. See `docs/security/secrets-policy.md`.

## Task dashboard
`pnpm run dashboard` (`scripts/dashboard-server.mjs`) serves the
`tasks/registry.yaml` roadmap/kanban view at `http://localhost:4747/`
(override with `DASHBOARD_PORT`). Unlike a one-off snapshot, the registry
data is read live from disk on every request and pushed to the open tab
over Server-Sent Events the moment `tasks/registry.yaml` changes — running
any `task-registry` command updates the dashboard within about a second,
no manual refresh. Local-only (binds `127.0.0.1`), no auth, plain
`node:http` — not something to expose beyond localhost. Leave it running
in a terminal (or a background process) for as long as you want the
dashboard available; it has no persistence of its own beyond the
registry file, so restarting it is always safe.
