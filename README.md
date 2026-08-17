# «Жизнь» — Life Platform

Русскоязычная семейная игровая платформа, где реальная жизнь ребёнка становится игровым прогрессом, а семья получает инструменты для развития, общения и совместных активностей.

## Start with the knowledge graph

1. `docs/MASTER_SPEC.md`
2. `docs/DOCS_GRAPH.md`
3. `docs/planning/roadmap-overview.md`
4. `docs/planning/phases/`
5. `docs/ai-team/`
6. `tasks/registry.yaml`

## Engineering model

The repository is designed for a coordinated AI team with a Human Architect at the top. Agents work in parallel branches/worktrees, pass independent gates and create Discoveries/New Tasks instead of silently expanding scope.

## Product clients

Child Web/PWA, Parent Web, Admin Web, Flutter Android/iOS, Telegram Mini App/Bot, MAX Mini App/Bot, Alice skill.

## Local foundation

See `docs/engineering/local-environment.md` and `docker-compose.dev.yml`.

## Important

This repository is the planning and engineering foundation. Phase 0 must establish the real Git remote, credentials, CI secrets and deploy environments before production code is accepted.
