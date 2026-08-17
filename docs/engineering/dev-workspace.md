# Development Workspace

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Goal
One reproducible environment shared by humans and AI agents.

## Local services
PostgreSQL, Redis and MinIO are provided by Docker Compose. Application processes may run on host for fast hot reload.

## Shared dev
A dedicated dev environment mirrors service boundaries and seeded synthetic data. Never use real child data.

## Staging
Production-like runtime with test accounts, synthetic media and isolated secrets.

## Repository
Git is the source of code truth. Docs and schemas are versioned with code.

## Agent workspace
One worktree per active agent; branch naming identifies role and task.
