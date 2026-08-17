# «Жизнь» — Life Platform

## What is this repository?
A multi-surface platform that turns real-life activities of children into an age-appropriate game: tasks, habits, quests, skills, rewards, friends, family interaction, learning and future cooperative games.

## Repository rule
The repository is driven by a short Master Specification plus a graph of small domain documents. Documents target <200 lines; split before they become large.

## First command
```bash
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm typecheck
pnpm test
```

## Main surfaces
- Child Web/PWA
- Parent Web
- Admin Web
- Flutter Android/iOS
- Telegram Mini App/Bot
- MAX Mini App/Bot
- Alice skill

## Core architecture
Modular monolith + workers + realtime first. PostgreSQL is the transactional source of truth; Redis handles cache/locks/queues; S3-compatible storage handles media.

## Development governance
Read `AGENTS.md` before making changes. Start from `docs/MASTER_SPEC.md` and `docs/DOCS_GRAPH.md`.
