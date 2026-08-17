# @life/fixtures

Deterministic synthetic family/child/task fixture generator for Phase 0
seed data, per `docs/implementations/phase-0-task-registry.md`'s sibling
requirement and `docs/engineering/local-environment.md` ("Use synthetic
family/child accounts only. Seed scripts must be deterministic.").

## What's here

- `src/rng.ts` — seeded PRNG (mulberry32), not cryptographic, only for
  reproducible fixture generation.
- `src/types.ts` — **placeholder** `SyntheticFamily`/`SyntheticChild`/
  `SyntheticTask` shapes. Not the authoritative domain contracts — those
  come from P0-009's Phase 1 contract pack (`packages/domain-types`).
  Replace these imports once that lands.
- `src/generators.ts` — `generateSyntheticFamilies(seed, count)`. Same seed
  always produces the same output (tested).
- `scripts/seed.mjs` — connects to the local Postgres from P0-002, inserts
  a summary row into `_phase0_fixtures_smoke` (not a real domain table —
  those don't exist until Phase 1 migrations), reads the last 5 back.
  This proves the "generate → connect → write → read" pipeline end to end
  today; it should be replaced with real domain inserts once Family/Task
  tables exist. The table itself is owned by
  `services/api/migrations/` (see `docs/architecture/data-architecture.md`
  "Migrations") — this script errors with a clear message if you haven't
  run the migration yet.

## Usage

```bash
pnpm dev:infra          # bring up Postgres/Redis/MinIO (P0-002)
pnpm dev:seed           # migrate:up, then build + run the seed script
```

Connection defaults to
`postgres://life:life_dev@localhost:${POSTGRES_HOST_PORT:-5433}/life`
(matching `docker-compose.dev.yml`'s dev-only credentials). Override with
`DATABASE_URL`. `FIXTURE_SEED` and `FIXTURE_FAMILY_COUNT` control the
generated data (defaults 42 and 5).

## Names

Child/family names are drawn from a small fixed list of generic Russian
given names and clearly-synthetic surnames (see `src/generators.ts`) — not
generated from or resembling any real person's data.
