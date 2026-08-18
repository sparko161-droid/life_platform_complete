# Implementation: Phase 0 Task Registry

## Scope
Source-controlled task registry for AI work before external tracker integration.

## Inputs
Task contract, agent registry, dependency list, phase/workstream.

## Outputs
Status, owner, reviewer, gate owners, links, discoveries, decisions.

## Required capabilities
Claim, handoff, block, reassign, add discovery, create child task, close task.

## Storage
YAML/Markdown initially; tracker adapter later.

## Acceptance
A task can be claimed by one agent, moved through gates and linked to a new Discovery-created task without editing history.

## Implementation
`tools/task-registry` — see its README for commands. `tasks/registry.yaml` is extended with `reviewer`, `gate_owners`, `discovery_links`, `blocked_reason`, `human_decisions`, `origin_discovery`, `discovered_from` per task.

`handoff` archives its report to `tasks/handoffs/<id>.md` (P0-010) instead of
only printing it, so a review can be reconstructed after the fact. The
matching contract-versioning half of P0-010 is `contracts/registry.yaml` —
see `docs/architecture/contract-registry.md`.
