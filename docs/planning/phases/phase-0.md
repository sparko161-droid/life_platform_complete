# Phase 0 — Engineering Workspace and AI Team

## Objective
Create the development system in which all future work is traceable, reproducible and safely parallel.

## Outputs

- Git repository and protected branches
- dev/stage/prod configuration model
- local Docker stack
- task registry and dependency graph
- AI agent registry and worktree rules
- CI baseline
- OpenAPI generation path
- seed fixtures
- observability baseline
- ADR and documentation workflow

## Responsible

AI CTO: coordination. Chief Architect: architecture baseline. DevOps Agent: environments. QA Lead: CI gates. Code Quality Lead: conventions.

## Dependencies

None beyond source control and human decisions on repository access.

## Exit criteria

A clean checkout can run static checks and local infrastructure can be started by a developer. AI agents can claim, branch, review and hand off tasks using the documented lifecycle.

## Parallel streams

A0 Git/CI, A1 Local infra, A2 Task registry, A3 AI governance, A4 Docs graph, A5 security baseline.

## Human decisions

Git provider, registry/tracker selection, secrets manager choice, initial hosting.
