# CI/CD Rules

**Status:** Foundation
**Owner:** DevOps / AI CTO

## Pull request gates

- format/lint
- typecheck
- unit tests
- integration tests
- build
- E2E for affected surfaces
- security checks
- architecture policy checks
- changed-file documentation check where required

## Branches

`main` protected.
Feature branches use `agent/<role>/<ticket>`.
Human hotfixes use `hotfix/<ticket>`.

## Merge

No direct push to `main`.
PR requires independent reviewer gates.

## Preview environments

Web apps should support automatic preview deployments for PRs where feasible.
Backend PRs use shared dev/stage or isolated ephemeral resources depending on impact.

## Release

Tag → build artifacts → stage → smoke test → approval → production.

## Rollback

Every production release must have a documented rollback path.
