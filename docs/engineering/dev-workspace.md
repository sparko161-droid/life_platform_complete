# Development Workspace — Phase 0

**Status:** Initial bootstrap
**Owner:** AI CTO + DevOps

## Goal

Создать постоянную среду, где команда работает параллельно, а локальные зависимости поднимаются один раз и живут независимо от частоты rebuild приложения.

## Required workspace

Git repository
Issue/task board
Documentation graph
AI agent registry
CI pipeline
Local Compose stack
Dev environment
Stage environment
Secrets management
Artifact registry

## Local stack

PostgreSQL + Redis + MinIO через `docker compose -f docker-compose.dev.yml up -d`.

Later add API/worker/realtime containers when code exists.

## Git model

`main` protected.
Agents use `agent/<role>/<ticket>` branches or isolated worktrees.
No shared mutable agent branch.

## Task board minimum fields

ID, title, domain, priority, owner agent, reviewer, status, dependencies, branch, PR, environment, risk, decision links.

## Build philosophy

Do not rebuild the whole platform for every feature. Use hot reload in local apps and stable infrastructure containers.

## Shared DEV

A deployed development environment accepts integrated branches after CI. It is the team integration point.

## STAGE

Production-like environment for release candidates and E2E/smoke tests.

## Initial workspace acceptance

- Git repository created
- branch protection defined
- CI skeleton active
- Docker local dependencies run
- docs graph committed
- agent registry committed
- task board process defined
- PR gates documented
