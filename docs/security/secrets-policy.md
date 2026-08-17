# Secrets Policy

**Status:** Foundation
**Owner:** AI CTO / Security & Child Safety Agent
**Depends on:** MASTER_SPEC, `docs/engineering/ci-cd.md`
**Related:** `docs/planning/phases/phase-0.md` ("Human decisions: ... secrets manager choice")

## Decision

**Doppler** is the secrets manager for this project (confirmed by the
Human Architect, 2026-08-17). Rationale: no new infrastructure to host or
operate (matches the foundation principle of not over-building before
evidence), a CLI good enough for local dev parity, and a native GitHub
Actions integration for CI. Revisit by ADR if operational needs outgrow it
(e.g. dynamic/short-lived secrets, on-prem requirements) — see
`docs/adr/`.

## Never in git

No real secret, API key, token, connection string with credentials, or
signing key is ever committed — not in code, not in `.env`, not in commit
history, not in a task packet, not in a discovery note. `.gitleaks.toml`
(root, enforced by `.github/workflows/ci.yml`'s `secret-scan` job, see
P0-001) is the automated backstop; it is not a substitute for this rule.

## What's allowed in git

- `.env.example` files: variable **names** only, with a placeholder or
  description, never a real value. See the ones added alongside this
  policy (root and per-service).
- The dev-only fixed credentials already in `docker-compose.dev.yml`
  (Postgres/Redis/MinIO). These are local-loopback-only defaults, not
  secrets — see `docs/engineering/local-environment.md`. `.gitleaks.toml`
  explicitly allowlists that file for this reason.

## Structure in Doppler

- Project `life-platform`
- Configs: `dev` (per-developer local overrides via `doppler setup`),
  `ci` (used by GitHub Actions), `stg`, `prd` — matching
  `docs/engineering/dev-workspace.md`'s dev/staging/production model.
- Access: `prd` secrets are restricted to release/deploy identities, never
  to ordinary coding agents, per `AGENTS.md` ("Never: Modify production
  secrets or production data") and `docs/architecture/security-boundaries.md`.

## Local development

```bash
doppler setup                 # once, links this checkout to the `dev` config
doppler run -- pnpm dev       # injects secrets as env vars for the process
```

No secret ever touches a file on disk in plaintext beyond Doppler's own
local cache.

## CI

`dopplerhq/cli-action` (or `doppler run --` inside a step) fetches the
`ci` config's secrets at job time using a `DOPPLER_TOKEN` stored in
**GitHub Actions Encrypted Secrets** (the one thing that *is* a GitHub
secret rather than a Doppler one — Doppler needs a bootstrap credential
from somewhere). Not yet wired into `.github/workflows/ci.yml`: today's
pipeline (P0-001) doesn't need any secret yet since nothing calls an
external provider. Add the step when the first task that does (e.g. an AI
provider call, a real database migration against a hosted DB) needs one.

## Rotation

Not yet scheduled — there are no production secrets yet. Define a rotation
schedule before any production credential is issued, tracked against
`docs/planning/phases/phase-0.md`'s exit criteria for later phases.

## Incident

A leaked secret is rotated immediately in Doppler and the leaking commit
is treated as public (git history rewrite does not un-leak a secret that
reached a remote). Report per `docs/ai-team/escalation.md`.
