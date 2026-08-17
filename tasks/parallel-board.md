# Parallel Development Board

**Owner:** AI CTO

## Board columns

DISCOVERY → READY → CLAIMED → IN_PROGRESS → REVIEW → QA → SECURITY → ACCEPTANCE → MERGED.

## Rules

One primary executor per task. Reviewer and gate owners are separate identities.

No agent changes another agent's branch. Integration is done through PRs.

A task may enter parallel execution only after its contract and dependencies are frozen.

## Current Phase 0 lanes

A0 CI/Git

A1 Local Infrastructure

A2 AI Task Orchestration

A3 Architecture/Contracts

A4 QA Fixtures

A5 Security Baseline

## Handoff

Every handoff links the PR, branch, changed modules, contract version, tests, known risks and discoveries.
