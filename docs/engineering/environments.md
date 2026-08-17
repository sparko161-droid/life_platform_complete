# Environments

**Status:** Foundation
**Owner:** AI CTO / DevOps Lead
**Depends on:** MASTER_SPEC, `docs/engineering/dev-workspace.md`, `docs/security/secrets-policy.md`
**Related:** `docs/engineering/local-environment.md`, `docs/engineering/ci-cd.md`

Phase-0 checklist item: "Dev/Stage/Prod environments defined." This
document defines the **configuration model** — env var/secrets shape and
promotion flow — that's implementable and testable today. It does NOT
pick a hosting provider for staging/production: that's a genuine human
decision (budget, region for RU data residency per
`docs/security/legal-ru.md`, existing infra relationships) that isn't
resolved here, same as `phase-0.md`'s "Human decisions" list already
flagged. The model below is ready to point at real infrastructure the
moment that decision is made.

## Environments

| Environment | Purpose | Data | Where it runs today |
|---|---|---|---|
| `dev` | Local development | Synthetic only (`packages/fixtures`) | `docker-compose.dev.yml` on the developer's machine |
| `ci` | Automated checks | None persisted — ephemeral per CI run | GitHub Actions runners (`.github/workflows/ci.yml`) |
| `stg` | Pre-production validation | Synthetic/test accounts only, never real child data | **Not provisioned yet** — hosting provider is an open human decision |
| `prd` | Production | Real family/child data | **Not provisioned yet** — same open decision |

## Config model

Every environment resolves the same set of env vars (`.env.example` at
repo root enumerates the current names); only the *values* differ, and
`stg`/`prd` values live in Doppler, never in a file, per
`docs/security/secrets-policy.md`. Doppler's `dev`/`ci`/`stg`/`prd`
configs map 1:1 to this table's rows (that structure was already
decided in P0-008 — this document is the environment-model half of the
same decision, not a new one).

## Promotion flow

`dev` → `ci` (every PR) → `stg` (every merge to `main`, once
provisioned) → `prd` (manual/gated promotion from a validated `stg`
build). No environment is skipped: a change reaches `prd` only after
passing through `stg` with real (synthetic-data) smoke tests, per
`docs/engineering/ci-cd.md`'s "Deploy pipeline" (`Merge to main → build
artifact → deploy staging → smoke tests → human/AI release gate →
production`).

## What changes between environments

- **Secrets/credentials**: Doppler config only (`docs/security/secrets-policy.md`).
- **Data**: `dev`/`stg` are synthetic-only, always. `prd` is the only
  environment ever allowed to hold real child/family data — see
  `docs/security/privacy.md` and `docs/product/family-lifecycle.md`.
- **Hostnames/URLs**: TBD with the hosting decision; `services/api`'s
  eventual config loader should read a single `NODE_ENV`-equivalent
  selector and never hardcode environment-specific URLs in application
  code (matches `docs/engineering/coding-standards.md`'s "no ad-hoc"
  principle applied to config).
- **Observability**: `OTEL_EXPORTER_OTLP_ENDPOINT`/`SENTRY_DSN` (see
  `packages/observability`) point at environment-specific collectors;
  both are optional and no-op cleanly when unset, so `dev` never needs
  a real collector.

## Explicitly not decided here

- Hosting provider / region for `stg` and `prd`.
- Whether `stg` and `prd` share infrastructure (e.g. same Kubernetes
  cluster, isolated namespace) or are fully separate accounts. Prefer
  full separation for blast-radius containment once a provider is
  chosen — flagged for the Human Architect, not decided unilaterally
  here.
- Domain/DNS.

These become their own task once the hosting decision is made; this
document is the config-model half that doesn't block on it.
