# P0-003 — Task Registry Lifecycle

## Goal
Implement source-controlled task lifecycle metadata required by the AI team.

## Why
Agents need one shared truth for ownership, status, dependencies and review outcomes.

## Owner
AI CTO / Orchestration Agent.

## Acceptance
- task status state machine is represented
- single primary executor is enforced
- reviewer and gate owner fields exist
- dependency links exist
- discovery links exist
- blocked reasons exist
- human decisions can be linked

## Out of scope
External SaaS tracker integration.

## Dependencies
None.

## Review
QA Agent validates lifecycle transitions; Architecture Agent validates alignment with task policy.
