# Жизнь — Life Platform

## Purpose

«Жизнь» — русскоязычная игровая платформа для детей и родителей. Ребёнок прокачивает реальную жизнь через задания, привычки, спорт, обучение, квесты, дружбу, совместные игры и награды. Родитель управляет правилами семьи, а AI-команда помогает развивать продукт и кодовую базу.

## Documentation rule

`docs/MASTER_SPEC.md` — навигационный источник истины, но не хранилище всех деталей. Детали живут в коротких документах, связанных через `docs/DOCS_GRAPH.md`.

Правило: один markdown-файл обычно 80–180 строк, абсолютный лимит — 200 строк. Если документ растёт, его делят на дочерние документы.

## Repository shape

```text
apps/                 клиентские приложения
packages/             shared packages
services/             backend/worker/integration modules
infrastructure/       local/dev/stage/prod infrastructure
.ai/                   AI-team policies, roles, workflows
.github/               CI/CD workflows
docs/                 project knowledge base
```

## Initial stack

- TypeScript
- React / Next.js
- NestJS
- PostgreSQL
- Redis
- BullMQ
- WebSocket
- S3-compatible object storage
- Flutter / Dart for Android + iOS
- MediaPipe/MoveNet abstraction for pose
- REST + OpenAPI
- Playwright + unit/integration tests
- Docker Compose locally

## Environments

- `local` — developer machine
- `dev` — shared development
- `stage` — release candidate
- `prod` — production

## First milestone

Создать управляемое development space, в котором:

1. Все задачи проходят через единый workflow.
2. AI-агенты работают в отдельных ветках.
3. CI проверяет каждый PR.
4. Несколько AI-ревьюеров проверяют работу друг друга.
5. Разработка использует постоянно поднятую инфраструктуру, а не отдельный build на каждую фичу.
6. Архитектурные вопросы эскалируются человеку-архитектору.
